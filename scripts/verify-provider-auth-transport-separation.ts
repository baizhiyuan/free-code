import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

export type SeparationViolation = {
  file: string
  reason: string
  excerpt: string
}

type SeparationRule = {
  file: string
  reason: string
  forbiddenPatterns: RegExp[]
}

const SEPARATION_RULES: SeparationRule[] = [
  {
    file: 'src/utils/model/providers.ts',
    reason:
      'provider mode resolution must stay separate from direct credential source and ChatGPT transport markers',
    forbiddenPatterns: [
      /\bOPENAI_API_KEY\b/,
      /\bgetCodexOAuthTokens\b/,
      /\bcodexOAuth\b/,
      /\bgetClaudeAIOAuthTokens\b/,
      /chatgpt\.com\/backend-api\/codex\/responses/,
      /\bchatgpt-account-id\b/,
      /\boriginator\b/,
    ],
  },
  {
    file: 'src/utils/auth.ts',
    reason:
      'credential source logic must not hardcode transport endpoints or ChatGPT-only headers',
    forbiddenPatterns: [
      /chatgpt\.com\/backend-api\/codex\/responses/,
      /\bchatgpt-account-id\b/,
      /\boriginator\b/,
      /\bwire_api\b/i,
    ],
  },
  {
    file: 'src/services/api/codex-fetch-adapter.ts',
    reason:
      'transport wrappers must not own provider-mode selection flags directly',
    forbiddenPatterns: [
      /\bgetAPIProvider\b/,
      /\bCLAUDE_CODE_USE_OPENAI\b/,
      /\bCLAUDE_CODE_USE_BEDROCK\b/,
      /\bCLAUDE_CODE_USE_VERTEX\b/,
      /\bCLAUDE_CODE_USE_FOUNDRY\b/,
    ],
  },
  {
    file: 'src/services/api/client.ts',
    reason:
      'client assembly should delegate ChatGPT-specific transport details to adapter files',
    forbiddenPatterns: [
      /chatgpt\.com\/backend-api\/codex\/responses/,
      /\bchatgpt-account-id\b/,
      /\boriginator\b/,
    ],
  },
]

function createExcerpt(content: string, index: number): string {
  const lineStart = content.lastIndexOf('\n', index - 1) + 1
  const lineEnd = content.indexOf('\n', index)
  return content
    .slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
    .trim()
}

export function collectSeparationViolations(
  files: Record<string, string>,
): SeparationViolation[] {
  const violations: SeparationViolation[] = []

  for (const rule of SEPARATION_RULES) {
    const content = files[rule.file]
    if (!content) {
      violations.push({
        file: rule.file,
        reason: 'expected source file missing from verification set',
        excerpt: '',
      })
      continue
    }

    for (const pattern of rule.forbiddenPatterns) {
      const match = pattern.exec(content)
      if (!match || match.index === undefined) {
        continue
      }

      violations.push({
        file: rule.file,
        reason: rule.reason,
        excerpt: createExcerpt(content, match.index),
      })
    }
  }

  return violations
}

export function loadRuleFiles(repoRoot: string): Record<string, string> {
  return Object.fromEntries(
    SEPARATION_RULES.map(rule => [
      rule.file,
      readFileSync(resolve(repoRoot, rule.file), 'utf8'),
    ]),
  )
}

async function main(): Promise<void> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const violations = collectSeparationViolations(loadRuleFiles(repoRoot))

  if (violations.length > 0) {
    console.error(
      'FAIL: provider mode, credential source, and transport binding boundaries regressed.',
    )
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.reason}`)
      if (violation.excerpt) {
        console.error(`  ${violation.excerpt}`)
      }
    }
    process.exit(1)
  }

  console.log(
    'PASS: provider mode, credential source, and transport binding remain separated at the guarded module boundaries.',
  )
}

if (import.meta.main) {
  await main()
}
