import { describe, expect, it } from 'bun:test'

import { collectSeparationViolations } from './verify-provider-auth-transport-separation.ts'

describe('collectSeparationViolations', () => {
  it('passes when guarded files stay within their boundaries', () => {
    const violations = collectSeparationViolations({
      'src/utils/model/providers.ts':
        "export function getAPIProvider() { return 'openai' }\n",
      'src/utils/auth.ts':
        'export function isCodexSubscriber() { return !!getCodexOAuthTokens()?.accessToken }\n',
      'src/services/api/codex-fetch-adapter.ts':
        "export const endpoint = 'https://chatgpt.com/backend-api/codex/responses'\n",
      'src/services/api/client.ts':
        'const codexFetch = createCodexFetch(token)\n',
    })

    expect(violations).toHaveLength(0)
  })

  it('flags provider files that start depending on credential or transport markers', () => {
    const violations = collectSeparationViolations({
      'src/utils/model/providers.ts':
        "const key = process.env.OPENAI_API_KEY\nconst url = 'https://chatgpt.com/backend-api/codex/responses'\n",
      'src/utils/auth.ts': 'export const ok = true\n',
      'src/services/api/codex-fetch-adapter.ts': 'export const ok = true\n',
      'src/services/api/client.ts': 'export const ok = true\n',
    })

    expect(violations).toHaveLength(2)
    expect(violations[0]?.file).toBe('src/utils/model/providers.ts')
  })

  it('flags auth or client files that take on transport-only details', () => {
    const violations = collectSeparationViolations({
      'src/utils/model/providers.ts': 'export const ok = true\n',
      'src/utils/auth.ts':
        "const header = 'chatgpt-account-id'\nconst api = 'wire_api'\n",
      'src/services/api/codex-fetch-adapter.ts': 'export const ok = true\n',
      'src/services/api/client.ts': "headers.originator = 'free-code'\n",
    })

    expect(violations).toHaveLength(3)
  })

  it('flags transport wrappers that start owning provider-mode selection', () => {
    const violations = collectSeparationViolations({
      'src/utils/model/providers.ts': 'export const ok = true\n',
      'src/utils/auth.ts': 'export const ok = true\n',
      'src/services/api/codex-fetch-adapter.ts':
        "if (process.env.CLAUDE_CODE_USE_OPENAI) return getAPIProvider()\n",
      'src/services/api/client.ts': 'export const ok = true\n',
    })

    expect(violations).toHaveLength(2)
    expect(violations[0]?.file).toBe('src/services/api/codex-fetch-adapter.ts')
  })
})
