import { describe, expect, it } from 'bun:test'

import {
  collectDirectOpenAIViolations,
  type BoundarySourceFile,
} from './verify-direct-openai-boundary.ts'

function file(path: string, content: string): BoundarySourceFile {
  return { path, content }
}

describe('collectDirectOpenAIViolations', () => {
  it('allows legacy codex wrapper files to keep explicit chatgpt bindings', () => {
    const violations = collectDirectOpenAIViolations([
      file(
        'src/services/api/codex-fetch-adapter.ts',
        "const url = 'https://chatgpt.com/backend-api/codex/responses'\nheaders['chatgpt-account-id'] = accountId\n",
      ),
      file(
        'src/services/oauth/codex-client.ts',
        "url.searchParams.set('originator', 'free-code')\n",
      ),
    ])

    expect(violations).toHaveLength(0)
  })

  it('flags chatgpt endpoint leakage in non-legacy files', () => {
    const violations = collectDirectOpenAIViolations([
      file(
        'src/services/api/openai-direct.ts',
        "const url = 'https://chatgpt.com/backend-api/codex/responses'\n",
      ),
    ])

    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toContain('legacy Codex wrapper')
  })

  it('flags chatgpt-only headers outside the legacy wrapper', () => {
    const violations = collectDirectOpenAIViolations([
      file(
        'src/services/api/openai-direct.ts',
        "headers['chatgpt-account-id'] = accountId\nheaders.originator = 'free-code'\n",
      ),
    ])

    expect(violations).toHaveLength(2)
  })
})
