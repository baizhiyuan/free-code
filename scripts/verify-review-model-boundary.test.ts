import { describe, expect, it } from 'bun:test'

import { collectViolations, type SourceFile } from './verify-review-model-boundary.ts'

function file(path: string, content: string): SourceFile {
  return { path, content }
}

describe('collectViolations', () => {
  it('passes when review_model is absent', () => {
    const violations = collectViolations([
      file(
        'src/utils/openai/runtime.ts',
        'const model = settings.model\nexport { model }\n',
      ),
    ])

    expect(violations).toHaveLength(0)
  })

  it('flags direct reviewModel to advisorModel assignment', () => {
    const violations = collectViolations([
      file(
        'src/utils/openai/runtime.ts',
        'const runtime = { advisorModel: reviewModel }\n',
      ),
    ])

    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toContain('advisorModel')
  })

  it('flags review_model references inside advisor-specific files', () => {
    const violations = collectViolations([
      file(
        'src/utils/advisor.ts',
        'export const value = settings.reviewModel ?? "gpt-5.4"\n',
      ),
    ])

    expect(violations).toHaveLength(1)
    expect(violations[0]?.file).toBe('src/utils/advisor.ts')
  })

  it('allows a dedicated review boundary outside advisor surfaces', () => {
    const violations = collectViolations([
      file(
        'src/utils/openai/reviewBoundary.ts',
        'export const runtime = { reviewModel: settings.reviewModel }\n',
      ),
    ])

    expect(violations).toHaveLength(0)
  })
})
