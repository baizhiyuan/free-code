import { getDefaultMainLoopModel } from '../model/model.js'

// When the user has never set teammateDefaultModel in /config and the spawn
// request does not explicitly pass a model or inherit a parent one, teammates
// should fall back to the session/provider default rather than a Claude-only
// hardcoded model family. This keeps OpenAI sessions on GPT-class models and
// preserves provider-aware defaults for Bedrock/Vertex/Foundry.
export function getHardcodedTeammateModelFallback(): string {
  return getDefaultMainLoopModel()
}
