import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { logForDebugging } from './debug.js'

type RawCompatConfig = {
  model_provider?: unknown
  model?: unknown
  review_model?: unknown
  model_reasoning_effort?: unknown
  disable_response_storage?: unknown
  network_access?: unknown
  windows_wsl_setup_acknowledged?: unknown
  model_context_window?: unknown
  model_auto_compact_token_limit?: unknown
  model_providers?: {
    OpenAI?: {
      name?: unknown
      base_url?: unknown
      wire_api?: unknown
      requires_openai_auth?: unknown
    }
  }
}

export type OpenAICompatConfig = {
  sourcePath?: string
  modelProvider?: string
  model?: string
  reviewModel?: string
  modelReasoningEffort?: string
  disableResponseStorage?: boolean
  networkAccess?: string
  windowsWslSetupAcknowledged?: boolean
  modelContextWindow?: number
  modelAutoCompactTokenLimit?: number
  openAIBaseUrl?: string
  openAIWireApi?: string
  openAIRequiresAuth?: boolean
}

let cachedCompatConfig: OpenAICompatConfig | null | undefined

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return undefined
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function coerceString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function getCandidateConfigPaths(): string[] {
  const paths = [
    process.env.FREE_CODE_CONFIG_TOML,
    process.env.CODEX_CONFIG_TOML,
    join(homedir(), '.codex', 'config.toml'),
    join(homedir(), '.free-code', 'config.toml'),
    join(homedir(), '.config', 'free-code', 'config.toml'),
  ].filter((value): value is string => typeof value === 'string' && value.trim() !== '')

  return Array.from(new Set(paths))
}

function readCompatConfigFromDisk(): OpenAICompatConfig | null {
  const tomlParser = globalThis.Bun?.TOML?.parse
  if (typeof tomlParser !== 'function') {
    return null
  }

  for (const candidate of getCandidateConfigPaths()) {
    try {
      if (!existsSync(candidate)) continue
      const raw = tomlParser(readFileSync(candidate, 'utf8')) as RawCompatConfig
      const openAIProvider = raw.model_providers?.OpenAI
      return {
        sourcePath: candidate,
        modelProvider: coerceString(raw.model_provider),
        model: coerceString(raw.model),
        reviewModel: coerceString(raw.review_model),
        modelReasoningEffort: coerceString(raw.model_reasoning_effort),
        disableResponseStorage: coerceBoolean(raw.disable_response_storage),
        networkAccess: coerceString(raw.network_access),
        windowsWslSetupAcknowledged: coerceBoolean(
          raw.windows_wsl_setup_acknowledged,
        ),
        modelContextWindow: coerceNumber(raw.model_context_window),
        modelAutoCompactTokenLimit: coerceNumber(
          raw.model_auto_compact_token_limit,
        ),
        openAIBaseUrl: coerceString(openAIProvider?.base_url),
        openAIWireApi: coerceString(openAIProvider?.wire_api),
        openAIRequiresAuth: coerceBoolean(openAIProvider?.requires_openai_auth),
      }
    } catch (error) {
      logForDebugging(
        `Failed to parse OpenAI compatibility config at ${candidate}: ${error instanceof Error ? error.message : String(error)}`,
        { level: 'error' },
      )
    }
  }

  return null
}

export function getOpenAICompatConfig(): OpenAICompatConfig {
  if (cachedCompatConfig !== undefined) {
    return cachedCompatConfig ?? {}
  }

  cachedCompatConfig = readCompatConfigFromDisk()
  return cachedCompatConfig ?? {}
}

export function clearOpenAICompatConfigCache(): void {
  cachedCompatConfig = undefined
}

export function isOpenAICompatProviderConfigured(): boolean {
  return getOpenAICompatConfig().modelProvider?.toLowerCase() === 'openai'
}

export function getOpenAICompatModel(): string | undefined {
  return getOpenAICompatConfig().model
}

export function getConfiguredReviewModel(): string | undefined {
  return getOpenAICompatConfig().reviewModel
}

export function getConfiguredReasoningEffort(): string | undefined {
  return getOpenAICompatConfig().modelReasoningEffort
}

export function getConfiguredModelContextWindow(): number | undefined {
  return getOpenAICompatConfig().modelContextWindow
}

export function getConfiguredModelAutoCompactTokenLimit(): number | undefined {
  return getOpenAICompatConfig().modelAutoCompactTokenLimit
}

export function getOpenAIBaseUrl(): string | undefined {
  return process.env.OPENAI_BASE_URL?.trim() || getOpenAICompatConfig().openAIBaseUrl
}

export function getOpenAIWireApi(): string | undefined {
  return getOpenAICompatConfig().openAIWireApi
}
