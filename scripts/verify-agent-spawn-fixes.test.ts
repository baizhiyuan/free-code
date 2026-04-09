import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { CLAUDE_CODE_GUIDE_AGENT } from '../src/tools/AgentTool/built-in/claudeCodeGuideAgent.js'
import { ensureTeamFileAsync, readTeamFileAsync } from '../src/utils/swarm/teamHelpers.js'
import { TEAM_LEAD_NAME } from '../src/utils/swarm/constants.js'

const ORIGINAL_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR

afterEach(() => {
  if (ORIGINAL_CONFIG_DIR === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR
  } else {
    process.env.CLAUDE_CONFIG_DIR = ORIGINAL_CONFIG_DIR
  }
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
})
