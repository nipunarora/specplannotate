<p align="center">
  <img src="apps/marketing/public/og-image.webp" alt="Plannotator" width="80%" />
</p>

# Plannotator

Interactive Plan Review for AI Coding Agents. Mark up and refine your plans using a visual UI, share for team collaboration, and seamlessly integrate with **Claude Code** and **OpenCode**.

<table>
<tr>
<td align="center" width="50%">
<h3>Claude Code</h3>
<a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">
<img src="apps/marketing/public/youtube.png" alt="Claude Code Demo" width="100%" />
</a>
<p><a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">Watch Demo</a></p>
</td>
<td align="center" width="50%">
<h3>OpenCode</h3>
<a href="https://youtu.be/_N7uo0EFI-U">
<img src="apps/marketing/public/youtube-opencode.png" alt="OpenCode Demo" width="100%" />
</a>
<p><a href="https://youtu.be/_N7uo0EFI-U">Watch Demo</a></p>
</td>
</tr>
</table>


**New:**

 - **Spec-Kit Review** *(Jan 2026)* — Run `/speckit-review` to review [spec-kit](https://github.com/github/spec-kit) specification documents. Annotations (deletions, replacements, insertions) are applied directly to your spec files on approval!
 - **Code Review** *(Jan 2026)* — Run `/plannotator-review` to review git diffs with inline annotations (select line numbers to annotate), switch between diff views, and send feedback to your agent
 - Attach and annotate images with your feedback (pen, arrow, circle tools)
 - Auto-save approved plans to [Obsidian](https://obsidian.md/) and [Bear Notes](https://bear.app/)

## Install for Claude Code

**Install the `plannotator` command:**

**macOS / Linux / WSL:**

```bash
curl -fsSL https://raw.githubusercontent.com/nipunarora/specplannotate/main/scripts/install.sh | bash
```

**Windows PowerShell:**

```powershell
irm https://raw.githubusercontent.com/nipunarora/specplannotate/main/scripts/install.ps1 | iex
```

**Then in Claude Code:**

```
/plugin marketplace add nipunarora/specplannotate
/plugin install plannotator@plannotator

# IMPORTANT: Restart Claude Code after plugin install
```

See [apps/hook/README.md](apps/hook/README.md) for detailed installation instructions including a `manual hook` approach.

### Alternative Installation Methods

<details>
<summary><strong>Local Development/Testing</strong></summary>

**Prerequisites:**
- [Bun runtime](https://bun.sh) - Install via `curl -fsSL https://bun.sh/install | bash`

**Clone and build:**

```bash
git clone https://github.com/nipunarora/specplannotate.git
cd plannotator
bun install
bun run build:hook
```

**Build and install the binary locally:**

After making changes to server code (`apps/hook/server/`), rebuild the binary:

```bash
# Build for your platform (macOS ARM example)
bun build apps/hook/server/index.ts --compile --target=bun-darwin-arm64 --outfile plannotator-darwin-arm64

# Install locally
cp plannotator-darwin-arm64 ~/.local/bin/plannotator
chmod +x ~/.local/bin/plannotator
```

For other platforms, use these targets:
- macOS Intel: `bun-darwin-x64`
- Linux x64: `bun-linux-x64`
- Linux ARM: `bun-linux-arm64`
- Windows: `bun-windows-x64` (outputs `.exe`)

**Run with local plugin:**

```bash
claude --plugin-dir ./apps/hook
```

**Note:** When testing hooks (plan review), the globally installed `plannotator` binary is used. For UI-only changes (in `packages/editor/` or `packages/ui/`), run `bun run build:hook` and restart Claude Code. For server changes, rebuild the binary as shown above.

</details>

<details>
<summary><strong>Fork & Use Your Own Marketplace</strong></summary>

To distribute your own fork via the marketplace:

1. Fork/clone and push to your GitHub repo (must be public)

2. Update `.claude-plugin/marketplace.json` with your GitHub username:
   ```json
   {
     "owner": "your-github-username"
   }
   ```

3. Install via Claude Code:
   ```
   /plugin marketplace add your-github-username/plannotator
   /plugin install plannotator@plannotator
   ```

4. Restart Claude Code after installation

</details>

<details>
<summary><strong>Manual Hooks (No Plugin)</strong></summary>

Add hooks directly to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "plannotator"
          }
        ]
      }
    ]
  }
}
```

This requires the `plannotator` CLI to be installed first via the install script above.

</details>

---

## Install for OpenCode

Add to your `opencode.json`:

```json
{
  "plugin": ["@plannotator/opencode@latest"]
}
```

**Run the install script** to get `/plannotator-review`:

```bash
curl -fsSL https://raw.githubusercontent.com/nipunarora/specplannotate/main/scripts/install.sh | bash
```

**Windows:**
```powershell
irm https://raw.githubusercontent.com/nipunarora/specplannotate/main/scripts/install.ps1 | iex
```

This also clears any cached plugin versions. Then restart OpenCode.

---

## How It Works

When your AI agent finishes planning, Plannotator:

1. Opens the Plannotator UI in your browser
2. Lets you annotate the plan visually (delete, insert, replace, comment)
3. **Approve** → Agent proceeds with implementation
4. **Request changes** → Your annotations are sent back as structured feedback

---

## Spec-Kit Review

Review and edit [spec-kit](https://github.com/github/spec-kit) specification documents with file modification support.

**Setup your spec files:**
```
project/
├── specs/
│   └── your-feature-branch/
│       ├── spec.md          # Feature specification
│       ├── plan.md          # Technical plan
│       └── tasks.md         # Implementation tasks
```

**Run the review:**
```
/speckit-review
```

The command auto-detects your current git branch and loads specs from `specs/[branch-name]/`.

**Key features:**
- **File modification** — Annotations (deletions, replacements, insertions) are applied directly to your spec files when you click "Apply & Approve"
- **Deny button** — Send feedback to Claude without modifying files
- **Combined view** — All spec documents displayed in a single reviewable document

---

## License

**Copyright (c) 2025 nipunarora.**

This project is licensed under the **Business Source License 1.1 (BSL)**.
