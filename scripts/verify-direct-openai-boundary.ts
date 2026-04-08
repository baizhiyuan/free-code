import { readdirSync, readFileSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

export type BoundarySourceFile = {
  path: string
  content: string
}

export type DirectOpenAIViolation = {
  file: string
  reason: string
  excerpt: string
}

type ForbiddenPattern = {
  name: string
  pattern: RegExp
  allowedFiles: Set<string>
}

const SOURCE_ROOTS = ['src'] as const

const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    name: 'chatgpt backend endpoint',
    pattern: /chatgpt\.com\/backend-api\/codex\/responses/,
    allowedFiles: new Set(['src/services/api/codex-fetch-adapter.ts']),
  },
  {
    name: 'chatgpt account header',
    pattern: /chatgpt-account-id/,
    allowedFiles: new Set(['src/services/api/codex-fetch-adapter.ts']),
  },
  {
    name: 'originator parameter/header',
    pattern: /\boriginator\b/,
    allowedFiles: new Set([
      'src/services/api/codex-fetch-adapter.ts',
      'src/services/oauth/codex-client.ts',
    ]),
  },
]

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/')
}

function isSourceFile(path: string): boolean {
  return /\.(ts|tsx|js|jsx)$/.test(path)
}

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path)
}

function createExcerpt(content: string, index: number): string {
  const lineStart = content.lastIndexOf('\n', index - 1) + 1
  const lineEnd = content.indexOf('\n', index)
  return content
    .slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
    .trim()
}

export function collectDirectOpenAIViolations(
  files: BoundarySourceFile[],
): DirectOpenAIViolation[] {
  const violations: DirectOpenAIViolation[] = []

  for (const file of files) {
    for (const forbiddenPattern of FORBIDDEN_PATTERNS) {
      const match = forbiddenPattern.pattern.exec(file.content)
      if (!match || match.index === undefined) {
        continue
      }
      if (forbiddenPattern.allowedFiles.has(file.path)) {
        continue
      }

      violations.push({
        file: file.path,
        reason: `${forbiddenPattern.name} leaked outside the explicit legacy Codex wrapper`,
        excerpt: createExcerpt(file.content, match.index),
      })
    }
  }

  return violations
}

export function loadBoundarySourceFiles(repoRoot: string): BoundarySourceFile[] {
  const files: BoundarySourceFile[] = []

  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }

      const relativePath = normalizePath(relative(repoRoot, absolutePath))
      if (!isSourceFile(relativePath) || isTestFile(relativePath)) {
        continue
      }

      files.push({
        path: relativePath,
        content: readFileSync(absolutePath, 'utf8'),
      })
    }
  }

  for (const sourceRoot of SOURCE_ROOTS) {
    walk(join(repoRoot, sourceRoot))
  }

  return files
}

async function main(): Promise<void> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const violations = collectDirectOpenAIViolations(loadBoundarySourceFiles(repoRoot))

  if (violations.length > 0) {
    console.error(
      'FAIL: ChatGPT/Codex-only assumptions leaked outside the legacy wrapper files.',
    )
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.reason}`)
      console.error(`  ${violation.excerpt}`)
    }
    process.exit(1)
  }

  console.log(
    'PASS: chatgpt.com endpoint and chatgpt-only headers remain isolated to explicit legacy Codex wrapper files.',
  )
}

if (import.meta.main) {
  await main()
}
