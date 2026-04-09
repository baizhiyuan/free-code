<p align="center">
  <img src="assets/screenshot.png" alt="free-code" width="720" />
</p>

<h1 align="center">free-code</h1>

<p align="center">
  <strong>An OpenAI-direct-capable fork of the leaked Claude Code snapshot.</strong><br>
  Supports OpenAI-compatible Responses endpoints, Codex-style config compatibility,<br>
  stripped telemetry/guardrails, and a publish-safe local-first workflow.
</p>

<p align="center">
  <a href="#quick-install"><img src="https://img.shields.io/badge/install-one--liner-blue?style=flat-square" alt="Install" /></a>
  <a href="https://github.com/baizhiyuan/free-code/stargazers"><img src="https://img.shields.io/github/stars/baizhiyuan/free-code?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/baizhiyuan/free-code/issues"><img src="https://img.shields.io/github/issues/baizhiyuan/free-code?style=flat-square" alt="Issues" /></a>
  <a href="https://github.com/baizhiyuan/free-code/blob/main/FEATURES.md"><img src="https://img.shields.io/badge/features-88%20flags-orange?style=flat-square" alt="Feature Flags" /></a>
  <a href="#ipfs-mirror"><img src="https://img.shields.io/badge/IPFS-mirrored-teal?style=flat-square" alt="IPFS" /></a>
</p>

---

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/baizhiyuan/free-code/main/install.sh | bash
```

Checks your system, installs Bun if needed, clones the repo, builds with all experimental features enabled, and symlinks `free-code` on your PATH.

Then run `free-code` and authenticate with the provider path you want: use `/login` for Anthropic or legacy browser auth, or set `OPENAI_API_KEY` for OpenAI direct mode.

---

## Table of Contents

- [What is this](#what-is-this)
- [Model Providers](#model-providers)
- [Quick Install](#quick-install)
- [Requirements](#requirements)
- [Build](#build)
- [Usage](#usage)
- [Team Mode](#team-mode)
- [Experimental Features](#experimental-features)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [IPFS Mirror](#ipfs-mirror)
- [Contributing](#contributing)
- [License](#license)

---

## What is this

A maintained fork of Anthropic's leaked [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI snapshot, now oriented around practical local use rather than upstream product defaults.

The original source became publicly reconstructable from npm-distributed source maps. This fork keeps that base, but it is no longer just a mirror: it adds a distinct OpenAI-direct path, safer publish defaults, and a clearer local-first runtime story.

## Why this fork

This fork is useful if you want one or more of the following:

- **OpenAI Direct support** for OpenAI-compatible Responses endpoints
- **Codex-style compatibility config** via `~/.codex/config.toml`
- **Telemetry stripped** and guardrail overlays reduced
- **Experimental features unlocked** beyond the public npm release defaults
- **Verification guards** that keep OpenAI/provider/auth/transport boundaries from regressing

## What this fork changes

### OpenAI Direct support

The fork now includes a direct OpenAI provider path that:

- prefers `OPENAI_API_KEY` over browser-bound Codex assumptions
- targets OpenAI-compatible `/v1/responses` endpoints
- keeps ChatGPT/Codex-specific headers isolated to the explicit legacy fallback path
- supports sanitized public examples and local private configuration

### Codex-style compatibility config

The fork can read a Codex-style compatibility file at `~/.codex/config.toml`, including:

- `model_provider`
- `model`
- `review_model`
- `model_reasoning_effort`
- `model_context_window`
- `model_auto_compact_token_limit`
- `[model_providers.OpenAI]`

### Telemetry removed

The upstream binary phones home through OpenTelemetry/gRPC, GrowthBook analytics, Sentry error reporting, and custom event logging. In this build:

- All outbound telemetry endpoints are dead-code-eliminated or stubbed
- GrowthBook feature flag evaluation still works locally (needed for runtime feature gates) but does not report back
- No crash reports, no usage analytics, no session fingerprinting

### Security-prompt guardrails reduced

Anthropic injects system-level instructions into every conversation that constrain Claude's behavior beyond what the model itself enforces. These include hardcoded refusal patterns, injected "cyber risk" instruction blocks, and managed-settings security overlays pushed from Anthropic's servers.

This build strips those injections. The model's own safety training still applies -- this just removes the extra layer of prompt-level restrictions that the CLI wraps around it.

### Experimental features unlocked

Claude Code ships with 88 feature flags gated behind `bun:bundle` compile-time switches. Most are disabled in the public npm release. This build unlocks all 54 flags that compile cleanly. See [Experimental Features](#experimental-features) below, or refer to [FEATURES.md](FEATURES.md) for the full audit.

---

## Model Providers

free-code supports **five API providers** out of the box. Set the corresponding environment variable to switch providers -- no code changes needed.

### Anthropic (Direct API) -- Default

Use Anthropic's first-party API directly.

| Model | ID |
|---|---|
| Claude Opus 4.6 | `claude-opus-4-6` |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Claude Haiku 4.5 | `claude-haiku-4-5` |

### OpenAI Direct

Use OpenAI-compatible models through the OpenAI provider path. The primary setup uses `OPENAI_API_KEY`; browser OAuth is only for the legacy Codex web flow.

| Model | ID |
|---|---|
| GPT-5.3 Codex (recommended) | `gpt-5.3-codex` |
| GPT-5.4 | `gpt-5.4` |
| GPT-5.4 Mini | `gpt-5.4-mini` |

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="http://localhost:9090"
free-code
```

Or use the Codex-style compatibility file at `~/.codex/config.toml`:

```toml
model_provider = "OpenAI"
model = "gpt-5.4"
review_model = "gpt-5.4"
model_reasoning_effort = "xhigh"
disable_response_storage = true
network_access = "enabled"
windows_wsl_setup_acknowledged = true
model_context_window = 1000000
model_auto_compact_token_limit = 900000

[model_providers.OpenAI]
name = "OpenAI"
base_url = "http://localhost:9090"
wire_api = "responses"
requires_openai_auth = true
```

### AWS Bedrock

Route requests through your AWS account via Amazon Bedrock.

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION="us-east-1"   # or AWS_DEFAULT_REGION
free-code
```

Uses your standard AWS credentials (environment variables, `~/.aws/config`, or IAM role). Models are mapped to Bedrock ARN format automatically (e.g., `us.anthropic.claude-opus-4-6-v1`).

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_USE_BEDROCK` | Enable Bedrock provider |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | AWS region (default: `us-east-1`) |
| `ANTHROPIC_BEDROCK_BASE_URL` | Custom Bedrock endpoint |
| `AWS_BEARER_TOKEN_BEDROCK` | Bearer token auth |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH` | Skip auth (testing) |

### Google Cloud Vertex AI

Route requests through your GCP project via Vertex AI.

```bash
export CLAUDE_CODE_USE_VERTEX=1
free-code
```

Uses Google Cloud Application Default Credentials (`gcloud auth application-default login`). Models are mapped to Vertex format automatically (e.g., `claude-opus-4-6@latest`).

### Anthropic Foundry

Use Anthropic Foundry for dedicated deployments.

```bash
export CLAUDE_CODE_USE_FOUNDRY=1
export ANTHROPIC_FOUNDRY_API_KEY="..."
free-code
```

Supports custom deployment IDs as model names.

### Provider Selection Summary

| Provider | Env Variable | Auth Method |
|---|---|---|
| Anthropic (default) | -- | `ANTHROPIC_API_KEY` or OAuth |
| OpenAI direct | `CLAUDE_CODE_USE_OPENAI=1` | `OPENAI_API_KEY` |
| AWS Bedrock | `CLAUDE_CODE_USE_BEDROCK=1` | AWS credentials |
| Google Vertex AI | `CLAUDE_CODE_USE_VERTEX=1` | `gcloud` ADC |
| Anthropic Foundry | `CLAUDE_CODE_USE_FOUNDRY=1` | `ANTHROPIC_FOUNDRY_API_KEY` |

---

## Requirements

- **Runtime**: [Bun](https://bun.sh) >= 1.3.11
- **OS**: macOS or Linux (Windows via WSL)
- **Auth**: Provider-native credentials for your chosen provider

```bash
# Install Bun if you don't have it
curl -fsSL https://bun.sh/install | bash
```

---

## Build

```bash
git clone https://github.com/baizhiyuan/free-code.git
cd free-code
bun build
./cli
```

### Build Variants

| Command | Output | Features | Description |
|---|---|---|---|
| `bun run build` | `./cli` | `VOICE_MODE` only | Production-like binary |
| `bun run build:dev` | `./cli-dev` | `VOICE_MODE` only | Dev version stamp |
| `bun run build:dev:full` | `./cli-dev` | All 54 experimental flags | Full unlock build |
| `bun run compile` | `./dist/cli` | `VOICE_MODE` only | Alternative output path |

### Custom Feature Flags

Enable specific flags without the full bundle:

```bash
# Enable just ultraplan and ultrathink
bun run ./scripts/build.ts --feature=ULTRAPLAN --feature=ULTRATHINK

# Add a flag on top of the dev build
bun run ./scripts/build.ts --dev --feature=BRIDGE_MODE
```

---

## Usage

```bash
# Interactive REPL (default)
./cli

# One-shot mode
./cli -p "what files are in this directory?"

# Specify a model
./cli --model claude-opus-4-6

# Run from source (slower startup)
bun run dev

# OAuth login
./cli /login
```

## Team Mode

If you want to use the built-in team / teammate mode in this fork, use this flow:

1. **Start in the provider/model you actually want**
   - For GPT/OpenAI sessions, switch the main conversation to the OpenAI provider first.
2. **Create a team explicitly**
   - Use `TeamCreate` first instead of relying on an implicit `default` team.
3. **Prefer teammate agents with `model: "inherit"`**
   - That keeps teammates on the same GPT/OpenAI-capable model path as the parent session.
4. **Run general write-capable agents inside a git repo**
   - Team mode still expects git worktrees or configured `WorktreeCreate/WorktreeRemove` hooks for general code-editing agents.
5. **Use guide/help agents for non-git troubleshooting**
   - Documentation-focused agents such as `claude-code-guide` degrade more gracefully outside git repos, but that fallback is intentionally not global for all agents.

### Team mode troubleshooting

- **`Team "default" does not exist`**
  - The safest fix is still to create a team explicitly before spawning teammates.
- **`Cannot create agent worktree ... not in a git repository`**
  - For normal write-capable agents, run inside a git repository or configure worktree hooks.
  - For guide/help agents, this fork now falls back more gracefully in non-git directories.
- **Want GPT teammates instead of Claude-family defaults**
  - Keep the session on the OpenAI provider and use `model: "inherit"` for spawned teammates.

### Environment Variables Reference

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_AUTH_TOKEN` | Auth token (alternative) |
| `ANTHROPIC_MODEL` | Override default model |
| `ANTHROPIC_BASE_URL` | Custom API endpoint |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Custom Opus model ID |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Custom Sonnet model ID |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Custom Haiku model ID |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token via env |
| `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` | API key helper cache TTL |

---

## Experimental Features

The `bun run build:dev:full` build enables all 54 working feature flags. Highlights:

### Interaction & UI

| Flag | Description |
|---|---|
| `ULTRAPLAN` | Remote multi-agent planning on Claude Code web (Opus-class) |
| `ULTRATHINK` | Deep thinking mode -- type "ultrathink" to boost reasoning effort |
| `VOICE_MODE` | Push-to-talk voice input and dictation |
| `TOKEN_BUDGET` | Token budget tracking and usage warnings |
| `HISTORY_PICKER` | Interactive prompt history picker |
| `MESSAGE_ACTIONS` | Message action entrypoints in the UI |
| `QUICK_SEARCH` | Prompt quick-search |
| `SHOT_STATS` | Shot-distribution stats |

### Agents, Memory & Planning

| Flag | Description |
|---|---|
| `BUILTIN_EXPLORE_PLAN_AGENTS` | Built-in explore/plan agent presets |
| `VERIFICATION_AGENT` | Verification agent for task validation |
| `AGENT_TRIGGERS` | Local cron/trigger tools for background automation |
| `AGENT_TRIGGERS_REMOTE` | Remote trigger tool path |
| `EXTRACT_MEMORIES` | Post-query automatic memory extraction |
| `COMPACTION_REMINDERS` | Smart reminders around context compaction |
| `CACHED_MICROCOMPACT` | Cached microcompact state through query flows |
| `TEAMMEM` | Team-memory files and watcher hooks |

### Tools & Infrastructure

| Flag | Description |
|---|---|
| `BRIDGE_MODE` | IDE remote-control bridge (VS Code, JetBrains) |
| `BASH_CLASSIFIER` | Classifier-assisted bash permission decisions |
| `PROMPT_CACHE_BREAK_DETECTION` | Cache-break detection in compaction/query flow |

See [FEATURES.md](FEATURES.md) for the complete audit of all 88 flags, including 34 broken flags with reconstruction notes.

---

## Project Structure

```
scripts/
  build.ts                # Build script with feature flag system

src/
  entrypoints/cli.tsx     # CLI entrypoint
  commands.ts             # Command registry (slash commands)
  tools.ts                # Tool registry (agent tools)
  QueryEngine.ts          # LLM query engine
  screens/REPL.tsx        # Main interactive UI (Ink/React)

  commands/               # /slash command implementations
  tools/                  # Agent tool implementations (Bash, Read, Edit, etc.)
  components/             # Ink/React terminal UI components
  hooks/                  # React hooks
  services/               # API clients, MCP, OAuth, analytics
    api/                  # API client + Codex fetch adapter
    oauth/                # OAuth flows (Anthropic + OpenAI)
  state/                  # App state store
  utils/                  # Utilities
    model/                # Model configs, providers, validation
  skills/                 # Skill system
  plugins/                # Plugin system
  bridge/                 # IDE bridge
  voice/                  # Voice input
  tasks/                  # Background task management
```

---

## Tech Stack

| | |
|---|---|
| **Runtime** | [Bun](https://bun.sh) |
| **Language** | TypeScript |
| **Terminal UI** | React + [Ink](https://github.com/vadimdemedes/ink) |
| **CLI Parsing** | [Commander.js](https://github.com/tj/commander.js) |
| **Schema Validation** | Zod v4 |
| **Code Search** | ripgrep (bundled) |
| **Protocols** | MCP, LSP |
| **APIs** | Anthropic Messages, OpenAI Codex, AWS Bedrock, Google Vertex AI |

---

## IPFS Mirror

A full copy of this repository is permanently pinned on IPFS via Filecoin:

| | |
|---|---|
| **CID** | `bafybeiegvef3dt24n2znnnmzcud2vxat7y7rl5ikz7y7yoglxappim54bm` |
| **Gateway** | https://w3s.link/ipfs/bafybeiegvef3dt24n2znnnmzcud2vxat7y7rl5ikz7y7yoglxappim54bm |

If this repo gets taken down, the code lives on.

---

## Contributing

Contributions are welcome. If you're working on restoring one of the 34 broken feature flags, check the reconstruction notes in [FEATURES.md](FEATURES.md) first -- many are close to compiling and just need a small wrapper or missing asset.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat: add something'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

---

## License

The original Claude Code source is the property of Anthropic. This fork exists because the source was publicly exposed through their npm distribution. Use at your own discretion.
