import { readdirSync, readFileSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

export type SourceFile = {
  path: string
  content: string
}

export type ReviewModelBoundaryViolation = {
  file: string
  reason: string
  excerpt: string
}

const SOURCE_ROOTS = ['src'] as const

const ADVISOR_BOUNDARY_FILES = new Set([
  'src/commands/advisor.ts',
  'src/services/api/claude.ts',
  'src/utils/advisor.ts',
])

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/')
}

function isSourceFile(path: string): boolean {
  return /\.(ts|tsx|js|jsx)$/.test(path)
}

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path)
}

function hasReviewModelReference(content: string): boolean {
  return /\breviewModel\b|review_model/.test(content)
}

function createExcerpt(content: string, index: number): string {
  const lineStart = content.lastIndexOf('\n', index - 1) + 1
  const lineEnd = content.indexOf('\n', index)
  return content
    .slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
    .trim()
}

function findAdvisorBoundaryViolations(
  file: SourceFile,
): ReviewModelBoundaryViolation[] {
  if (!ADVISOR_BOUNDARY_FILES.has(file.path)) {
    return []
  }

  const violations: ReviewModelBoundaryViolation[] = []
  const lines = file.content.split('\n')

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!hasReviewModelReference(line)) {
      continue
    }
    if (
      trimmedLine.startsWith('//') ||
      trimmedLine.startsWith('/*') ||
      trimmedLine.startsWith('*')
    ) {
      continue
    }

    violations.push({
      file: file.path,
      reason:
        'review_model should stay out of advisor-specific files unless a separate review boundary is introduced',
      excerpt: trimmedLine,
    })
  }

  return violations
}

function findSilentMappingViolations(
  file: SourceFile,
): ReviewModelBoundaryViolation[] {
  const violations: ReviewModelBoundaryViolation[] = []
  const patterns = [
    {
      pattern:
        /\badvisorModel\s*[:=]\s*(?:await\s+)?(?:\w+\()?reviewModel\b|\badvisorModel\s*[:=]\s*.*\breview_model\b/,
      reason: 'reviewModel is being assigned into advisorModel',
    },
    {
      pattern:
        /\breviewModel\s*[:=]\s*(?:await\s+)?(?:\w+\()?advisorModel\b|\breviewModel\s*[:=]\s*.*\badvisor_model\b/,
      reason: 'advisorModel is being assigned into reviewModel',
    },
  ] as const

  for (const { pattern, reason } of patterns) {
    const match = pattern.exec(file.content)
    if (!match || match.index === undefined) {
      continue
    }

    violations.push({
      file: file.path,
      reason,
      excerpt: createExcerpt(file.content, match.index),
    })
  }

  return violations
}

export function collectViolations(
  files: SourceFile[],
): ReviewModelBoundaryViolation[] {
  const violations: ReviewModelBoundaryViolation[] = []

  for (const file of files) {
    violations.push(...findAdvisorBoundaryViolations(file))
    violations.push(...findSilentMappingViolations(file))
  }

  return violations
}

export function loadRepoSourceFiles(repoRoot: string): SourceFile[] {
  const files: SourceFile[] = []

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

export function verifyReviewModelBoundary(
  repoRoot: string,
): ReviewModelBoundaryViolation[] {
  return collectViolations(loadRepoSourceFiles(repoRoot))
}

function main(): void {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const files = loadRepoSourceFiles(repoRoot)
  const violations = collectViolations(files)
  const reviewModelFiles = files.filter(file =>
    hasReviewModelReference(file.content),
  )

  if (violations.length > 0) {
    console.error(
      'FAIL: review_model must stay separate from advisor until a dedicated review boundary exists.',
    )
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.reason}`)
      console.error(`  ${violation.excerpt}`)
    }
    process.exit(1)
  }

  if (reviewModelFiles.length === 0) {
    console.log(
      'PASS: no review_model runtime wiring detected yet; advisor boundary remains untouched.',
    )
    return
  }

  console.log(
    `PASS: found ${reviewModelFiles.length} review_model reference(s) without advisor reuse.`,
  )
}

if (import.meta.main) {
  main()
}
