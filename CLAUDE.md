# Plannotator

A plan review UI for Claude Code that intercepts `ExitPlanMode` via hooks, letting users approve or request changes with annotated feedback. Also provides code review for git diffs and spec-kit document review.

## Project Structure

```
plannotator/
├── apps/
│   ├── hook/                     # Claude Code plugin
│   │   ├── .claude-plugin/plugin.json
│   │   ├── commands/             # Slash commands (plannotator-review.md, speckit-review.md)
│   │   ├── hooks/hooks.json      # PermissionRequest hook config
│   │   ├── server/index.ts       # Entry point (plan + review + speckit subcommands)
│   │   └── dist/                 # Built single-file apps (index.html, review.html)
│   ├── opencode-plugin/          # OpenCode plugin
│   │   ├── commands/             # Slash commands (plannotator-review.md)
│   │   ├── index.ts              # Plugin entry with submit_plan tool + review event handler
│   │   ├── plannotator.html      # Built plan review app
│   │   └── review-editor.html    # Built code review app
│   └── review/                   # Standalone review server (for development)
│       ├── index.html
│       ├── index.tsx
│       └── vite.config.ts
├── packages/
│   ├── server/                   # Shared server implementation
│   │   ├── index.ts              # startPlannotatorServer(), handleServerReady()
│   │   ├── review.ts             # startReviewServer(), handleReviewServerReady()
│   │   ├── speckit.ts            # detectSpeckitContext(), combineSpeckitDocuments(), applyAnnotationsToFiles()
│   │   ├── speckit-server.ts     # startSpeckitServer() - speckit-specific server with file modification
│   │   ├── storage.ts            # Plan saving to disk (getPlanDir, savePlan, etc.)
│   │   ├── remote.ts             # isRemoteSession(), getServerPort()
│   │   ├── browser.ts            # openBrowser()
│   │   ├── integrations.ts       # Obsidian, Bear integrations
│   │   └── project.ts            # Project name detection for tags
│   ├── ui/                       # Shared React components
│   │   ├── components/           # Viewer, Toolbar, Settings, etc.
│   │   ├── utils/                # parser.ts, sharing.ts, storage.ts, planSave.ts, agentSwitch.ts
│   │   ├── hooks/                # useSharing.ts
│   │   └── types.ts
│   ├── editor/                   # Plan review App.tsx
│   └── review-editor/            # Code review UI
│       ├── App.tsx               # Main review app
│       ├── components/           # DiffViewer, FileTree, ReviewPanel
│       ├── demoData.ts           # Demo diff for standalone mode
│       └── index.css             # Review-specific styles
├── .claude-plugin/marketplace.json  # For marketplace install
└── legacy/                       # Old pre-monorepo code (reference only)
```

## Installation

**Via plugin marketplace** (when repo is public):

```
/plugin marketplace add nipunarora/specplannotate
```

**Local installation:**

```bash
# 1. Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash
# or: npm install -g bun

# 2. Clone and build
git clone https://github.com/nipunarora/specplannotate.git
cd plannotator
bun install
bun run build:review && bun run build:hook

# 3. Run Claude Code with the plugin
claude --plugin-dir ./apps/hook
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PLANNOTATOR_REMOTE` | Set to `1` or `true` for remote mode (devcontainer, SSH). Uses fixed port and skips browser open. |
| `PLANNOTATOR_PORT` | Fixed port to use. Default: random locally, `19432` for remote sessions. |
| `PLANNOTATOR_BROWSER` | Custom browser to open plans in. macOS: app name or path. Linux/Windows: executable path. |

**Legacy:** `SSH_TTY` and `SSH_CONNECTION` are still detected. Prefer `PLANNOTATOR_REMOTE=1` for explicit control.

**Devcontainer/SSH usage:**
```bash
export PLANNOTATOR_REMOTE=1
export PLANNOTATOR_PORT=9999
```

## Plan Review Flow

```
Claude calls ExitPlanMode
        ↓
PermissionRequest hook fires
        ↓
Bun server reads plan from stdin JSON (tool_input.plan)
        ↓
Server starts on random port, opens browser
        ↓
User reviews plan, optionally adds annotations
        ↓
Approve → stdout: {"hookSpecificOutput":{"decision":{"behavior":"allow"}}}
Deny    → stdout: {"hookSpecificOutput":{"decision":{"behavior":"deny","message":"..."}}}
```

## Code Review Flow

```
User runs /plannotator-review command
        ↓
Claude Code: plannotator review subcommand runs
OpenCode: event handler intercepts command
        ↓
git diff captures unstaged changes
        ↓
Review server starts, opens browser with diff viewer
        ↓
User annotates code, provides feedback
        ↓
Send Feedback → feedback sent to agent session
Approve → "LGTM" sent to agent session
```

## Speckit Review Flow

Review [spec-kit](https://github.com/github/spec-kit) specification documents for the current feature branch. Supports **file modification** - annotations (deletions, replacements, insertions) are applied directly to the source spec files on approval.

```
User runs /speckit-review command
        ↓
Detect current git branch name
        ↓
Read spec files from specs/[branch-name]/
  - spec.md (required)
  - plan.md (required)
  - tasks.md (required)
  - research.md, data-model.md, contracts/*.md (optional)
  - memory/constitution.md (optional, project-level)
        ↓
Combine all documents into single markdown with section headers
Track file mappings (which content came from which file)
        ↓
Speckit server starts, opens browser
        ↓
User reviews and annotates spec documents
        ↓
Deny   → feedback sent to Claude, no file changes
Approve → annotations applied to source files, then approved
```

**UI Buttons in Speckit Mode:**
- **Deny** (red) - Sends feedback to Claude without modifying files
- **Approve** / **Apply & Approve** - Applies annotations to source files, then approves

**Supported Annotation Types for File Modification:**
- `DELETION` - Remove the selected text from source file
- `REPLACEMENT` - Replace selected text with new text
- `INSERTION` - Insert new text after the selected context
- `COMMENT` - Feedback only, no file modification

**Expected directory structure:**
```
project/
├── memory/
│   └── constitution.md      # Project principles (optional)
├── specs/
│   └── feature-branch-name/
│       ├── spec.md          # Feature specification
│       ├── plan.md          # Technical plan
│       ├── tasks.md         # Implementation tasks
│       ├── research.md      # Research notes (optional)
│       ├── data-model.md    # Data structures (optional)
│       └── contracts/       # API specs (optional)
│           └── api.md
```

## Server API

### Plan Server (`packages/server/index.ts`)

| Endpoint              | Method | Purpose                                    |
| --------------------- | ------ | ------------------------------------------ |
| `/api/plan`           | GET    | Returns `{ plan, origin }`                 |
| `/api/approve`        | POST   | Approve plan (body: planSave, agentSwitch, obsidian, bear, feedback) |
| `/api/deny`           | POST   | Deny plan (body: feedback, planSave)       |
| `/api/image`          | GET    | Serve image by path query param            |
| `/api/upload`         | POST   | Upload image, returns temp path            |
| `/api/obsidian/vaults`| GET    | Detect available Obsidian vaults           |

### Review Server (`packages/server/review.ts`)

| Endpoint              | Method | Purpose                                    |
| --------------------- | ------ | ------------------------------------------ |
| `/api/diff`           | GET    | Returns `{ rawPatch, gitRef, origin }`     |
| `/api/feedback`       | POST   | Submit review (body: feedback, annotations, agentSwitch) |
| `/api/image`          | GET    | Serve image by path query param            |
| `/api/upload`         | POST   | Upload image, returns temp path            |

### Speckit Server (`packages/server/speckit-server.ts`)

| Endpoint              | Method | Purpose                                    |
| --------------------- | ------ | ------------------------------------------ |
| `/api/plan`           | GET    | Returns `{ plan, origin, mode: "speckit", featureName, fileMappings }` |
| `/api/approve`        | POST   | Apply annotations to files, approve (body: feedback, annotations) |
| `/api/deny`           | POST   | Deny without file changes (body: feedback) |
| `/api/image`          | GET    | Serve image by path query param            |
| `/api/upload`         | POST   | Upload image, returns temp path            |

**Approve response:**
```json
{
  "ok": true,
  "modifiedFiles": ["specs/feature/spec.md", "specs/feature/plan.md"],
  "errors": []
}
```

All servers use random ports locally or fixed port (`19432`) in remote mode.

## Data Types

**Location:** `packages/ui/types.ts`

```typescript
enum AnnotationType {
  DELETION = "DELETION",
  INSERTION = "INSERTION",
  REPLACEMENT = "REPLACEMENT",
  COMMENT = "COMMENT",
  GLOBAL_COMMENT = "GLOBAL_COMMENT",
}

interface Annotation {
  id: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
  type: AnnotationType;
  text?: string; // For comment/replacement/insertion
  originalText: string; // The selected text
  createdA: number; // Timestamp
  author?: string; // Tater identity
  startMeta?: { parentTagName; parentIndex; textOffset };
  endMeta?: { parentTagName; parentIndex; textOffset };
}

interface Block {
  id: string;
  type: "paragraph" | "heading" | "blockquote" | "list-item" | "code" | "hr";
  content: string;
  level?: number; // For headings (1-6)
  language?: string; // For code blocks
  order: number;
  startLine: number;
}
```

## Markdown Parser

**Location:** `packages/ui/utils/parser.ts`

`parseMarkdownToBlocks(markdown)` splits markdown into Block objects. Handles:

- Headings (`#`, `##`, etc.)
- Code blocks (``` with language extraction)
- List items (`-`, `*`, `1.`)
- Blockquotes (`>`)
- Horizontal rules (`---`)
- Paragraphs (default)

`exportDiff(blocks, annotations)` generates human-readable feedback for Claude.

## Annotation System

**Selection mode:** User selects text → toolbar appears → choose annotation type
**Redline mode:** User selects text → auto-creates DELETION annotation

Text highlighting uses `web-highlighter` library. Code blocks use manual `<mark>` wrapping (web-highlighter can't select inside `<pre>`).

## URL Sharing

**Location:** `packages/ui/utils/sharing.ts`, `packages/ui/hooks/useSharing.ts`

Shares full plan + annotations via URL hash using deflate compression.

**Payload format:**

```typescript
interface SharePayload {
  p: string; // Plan markdown
  a: ShareableAnnotation[]; // Compact annotations
}

type ShareableAnnotation =
  | ["D", string, string | null] // [type, original, author]
  | ["R", string, string, string | null] // [type, original, replacement, author]
  | ["C", string, string, string | null] // [type, original, comment, author]
  | ["I", string, string, string | null] // [type, context, newText, author]
  | ["G", string, string | null]; // [type, comment, author] - global comment
```

**Compression pipeline:**

1. `JSON.stringify(payload)`
2. `CompressionStream('deflate-raw')`
3. Base64 encode
4. URL-safe: replace `+/=` with `-_`

**On load from shared URL:**

1. Parse hash, decompress, restore annotations
2. Find text positions in rendered DOM via text search
3. Apply `<mark>` highlights
4. Clear hash from URL (prevents re-parse on refresh)

## Settings Persistence

**Location:** `packages/ui/utils/storage.ts`, `planSave.ts`, `agentSwitch.ts`

Uses cookies (not localStorage) because each hook invocation runs on a random port. Settings include identity, plan saving (enabled/custom path), and agent switching (OpenCode only).

## Syntax Highlighting

Code blocks use bundled `highlight.js`. Language is extracted from fence (```rust) and applied as `language-{lang}`class. Each block highlighted individually via`hljs.highlightElement()`.

## Requirements

- **Bun runtime** - Install via `curl -fsSL https://bun.sh/install | bash` or `npm install -g bun`
- Claude Code with plugin/hooks support, or OpenCode
- Cross-platform: macOS (`open`), Linux (`xdg-open`), Windows (`start`)

## Development

```bash
bun install

# Run any app
bun run dev:hook       # Hook server (plan review)
bun run dev:review     # Review editor (code review)
bun run dev:portal     # Portal editor
bun run dev:marketing  # Marketing site
```

## Build

```bash
bun run build:hook       # Single-file HTML for hook server
bun run build:review     # Code review editor
bun run build:opencode   # OpenCode plugin (copies HTML from hook + review)
bun run build:portal     # Static build for share.plannotator.ai
bun run build:marketing  # Static build for plannotator.ai
bun run build            # Build hook + opencode (main targets)
```

**Important:** The OpenCode plugin copies pre-built HTML from `apps/hook/dist/` and `apps/review/dist/`. When making UI changes (in `packages/ui/`, `packages/editor/`, or `packages/review-editor/`), you must rebuild the hook/review first:

```bash
bun run build:hook && bun run build:opencode   # For UI changes
```

Running only `build:opencode` will copy stale HTML files.

## Test plugin locally

```bash
claude --plugin-dir ./apps/hook
```

### Available slash commands

| Command | Description |
|---------|-------------|
| `/plannotator-review` | Review current git diff with annotations |
| `/speckit-review` | Review spec-kit documents for current feature branch |

### Testing speckit-review

1. Create spec files for your feature branch:
   ```bash
   # Assuming you're on branch "my-feature"
   mkdir -p specs/my-feature
   echo "# Specification

   This is the feature specification.

   ## Requirements
   - Requirement 1
   - Requirement 2" > specs/my-feature/spec.md

   echo "# Technical Plan

   ## Architecture
   The system uses a client-server architecture." > specs/my-feature/plan.md

   echo "# Tasks

   - [ ] Task 1: Setup
   - [ ] Task 2: Implementation
   - [ ] Task 3: Testing" > specs/my-feature/tasks.md
   ```

2. Run Claude Code with the plugin:
   ```bash
   claude --plugin-dir ./apps/hook
   ```

3. Use the `/speckit-review` command to review your spec documents

4. **To test file modification:**
   - Select text in the spec and create a DELETION, REPLACEMENT, or INSERTION annotation
   - Click "Apply & Approve"
   - Check that the source files in `specs/my-feature/` were modified

### Speckit Review Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Speckit Review UI                        │
├─────────────────────────────────────────────────────────────┤
│  [Deny]  [Apply & Approve]                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ## Specification                                     │   │
│  │                                                      │   │
│  │ This is the feature specification.     ← Select text │   │
│  │ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~         │   │
│  │ [Delete] [Replace] [Insert] [Comment]  ← Annotate    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ## Technical Plan                                    │   │
│  │ ...                                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

On "Apply & Approve":
  1. Annotations are sent to server
  2. Server finds each annotation's text in source files
  3. Applies DELETION/REPLACEMENT/INSERTION to source files
  4. Returns list of modified files
  5. UI shows "Spec Approved" with modified file list
```
