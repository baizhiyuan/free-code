import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { canFallBackFromWorktreeIsolation } from '../src/tools/AgentTool/AgentTool.js'
import { CLAUDE_CODE_GUIDE_AGENT } from '../src/tools/AgentTool/built-in/claudeCodeGuideAgent.js'
import { clearOpenAICompatConfigCache } from '../src/utils/openaiCompatConfig.js'
import { getHardcodedTeammateModelFallback } from '../src/utils/swarm/teammateModel.js'
import { ensureTeamFileAsync, readTeamFileAsync } from '../src/utils/swarm/teamHelpers.js'
import { TEAM_LEAD_NAME } from '../src/utils/swarm/constants.js'

const ORIGINAL_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR
const ORIGINAL_CODEX_CONFIG_TOML = process.env.CODEX_CONFIG_TOML
const ORIGINAL_CLAUDE_CODE_USE_OPENAI = process.env.CLAUDE_CODE_USE_OPENAI

afterEach(() => {
  if (ORIGINAL_CONFIG_DIR === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR
  } else {
    process.env.CLAUDE_CONFIG_DIR = ORIGINAL_CONFIG_DIR
  }
  if (ORIGINAL_CODEX_CONFIG_TOML === undefined) {
    delete process.env.CODEX_CONFIG_TOML
  } else {
    process.env.CODEX_CONFIG_TOML = ORIGINAL_CODEX_CONFIG_TOML
  }
  if (ORIGINAL_CLAUDE_CODE_USE_OPENAI === undefined) {
    delete process.env.CLAUDE_CODE_USE_OPENAI
  } else {
    process.env.CLAUDE_CODE_USE_OPENAI = ORIGINAL_CLAUDE_CODE_USE_OPENAI
  }
  clearOpenAICompatConfigCache()
})

describe('guide agent spawn fixes', () => {
  test('claude-code-guide inherits the active model instead of hardcoding Claude aliases', () => {
    expect(CLAUDE_CODE_GUIDE_AGENT.model).toBe('inherit')
  })

  test('ensureTeamFileAsync creates a missing team file for ad-hoc teammate spawns', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'free-code-team-file-'))
    process.env.CLAUDE_CONFIG_DIR = configDir

    try {
      const teamName = 'default'
      const teamFile = await ensureTeamFileAsync(teamName, {
        leadModel: 'gpt-5.4',
        cwd: '/tmp/project',
      })

      expect(teamFile.name).toBe(teamName)
      expect(teamFile.members).toHaveLength(1)
      expect(teamFile.members[0]?.name).toBe(TEAM_LEAD_NAME)
      expect(teamFile.members[0]?.model).toBe('gpt-5.4')

      const persisted = await readTeamFileAsync(teamName)
      expect(persisted?.name).toBe(teamName)
      expect(persisted?.members[0]?.name).toBe(TEAM_LEAD_NAME)
    } finally {
      rmSync(configDir, { force: true, recursive: true })
    }
  })

  test('OpenAI teammate fallback uses the OpenAI/GPT default model instead of a Claude-family fallback', async () => {
    const compatDir = mkdtempSync(join(tmpdir(), 'free-code-team-openai-'))
    const compatPath = join(compatDir, 'config.toml')
    process.env.CLAUDE_CODE_USE_OPENAI = '1'
    process.env.CODEX_CONFIG_TOML = compatPath
    await Bun.write(
      compatPath,
      [
        'model_provider = "OpenAI"',
        'model = "gpt-5.4"',
        '',
        '[model_providers.OpenAI]',
        'base_url = "http://localhost:9090"',
        'wire_api = "responses"',
      ].join('\n'),
    )
    clearOpenAICompatConfigCache()

    try {
      expect(getHardcodedTeammateModelFallback()).toBe('gpt-5.4')
    } finally {
      rmSync(compatDir, { force: true, recursive: true })
    }
  })

  test('worktree fallback remains scoped to claude-code-guide only', () => {
    expect(canFallBackFromWorktreeIsolation('claude-code-guide')).toBe(true)
    expect(canFallBackFromWorktreeIsolation('general-purpose')).toBe(false)
    expect(canFallBackFromWorktreeIsolation('executor')).toBe(false)
  })
})
