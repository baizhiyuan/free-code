import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  clearOpenAICompatConfigCache,
  getConfiguredModelAutoCompactTokenLimit,
  getConfiguredModelContextWindow,
  getConfiguredReasoningEffort,
  getConfiguredReviewModel,
  getOpenAIBaseUrl,
  getOpenAICompatConfig,
  getOpenAIWireApi,
} from '../src/utils/openaiCompatConfig.js'
import { getContextWindowForModel } from '../src/utils/context.js'
import { getAutoCompactThreshold } from '../src/services/compact/autoCompact.js'
import { getDefaultMainLoopModelSetting } from '../src/utils/model/model.js'
import { getAPIProvider } from '../src/utils/model/providers.js'

const ORIGINAL_CODEX_CONFIG_TOML = process.env.CODEX_CONFIG_TOML

function withCompatToml(toml: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'free-code-openai-compat-'))
  const file = join(dir, 'config.toml')
  writeFileSync(file, toml)
  process.env.CODEX_CONFIG_TOML = file
  clearOpenAICompatConfigCache()
  return dir
}

afterEach(() => {
  if (ORIGINAL_CODEX_CONFIG_TOML === undefined) {
    delete process.env.CODEX_CONFIG_TOML
  } else {
    process.env.CODEX_CONFIG_TOML = ORIGINAL_CODEX_CONFIG_TOML
  }
  clearOpenAICompatConfigCache()
})

describe('OpenAI compatibility config', () => {
  test('parses the Codex-style OpenAI compatibility file', () => {
    const dir = withCompatToml(`
model_provider = "OpenAI"
model = "gpt-5.4"
review_model = "gpt-5.4"
model_reasoning_effort = "xhigh"
model_context_window = 1000000
model_auto_compact_token_limit = 900000

[model_providers.OpenAI]
base_url = "http://localhost:9090"
wire_api = "responses"
requires_openai_auth = true
`)

    try {
      const config = getOpenAICompatConfig()
      expect(config.sourcePath).toBe(join(dir, 'config.toml'))
      expect(config.modelProvider).toBe('OpenAI')
      expect(getOpenAIBaseUrl()).toBe('http://localhost:9090')
      expect(getOpenAIWireApi()).toBe('responses')
      expect(getConfiguredReviewModel()).toBe('gpt-5.4')
      expect(getConfiguredReasoningEffort()).toBe('xhigh')
      expect(getConfiguredModelContextWindow()).toBe(1_000_000)
      expect(getConfiguredModelAutoCompactTokenLimit()).toBe(900_000)
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })

  test('feeds provider, model, context, and auto-compact defaults', () => {
    const dir = withCompatToml(`
model_provider = "OpenAI"
model = "gpt-5.4"
model_context_window = 1000000
model_auto_compact_token_limit = 900000

[model_providers.OpenAI]
base_url = "http://localhost:9090"
wire_api = "responses"
`)

    try {
      expect(getAPIProvider()).toBe('openai')
      expect(getDefaultMainLoopModelSetting()).toBe('gpt-5.4')
      expect(getContextWindowForModel('gpt-5.4')).toBe(1_000_000)
      expect(getAutoCompactThreshold('gpt-5.4')).toBe(900_000)
    } finally {
      rmSync(dir, { force: true, recursive: true })
    }
  })
})
