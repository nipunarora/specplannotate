# Plannotator

A visual plan review UI for Claude Code that intercepts `ExitPlanMode` and lets you annotate, approve, or provide structured feedback.

## Monorepo Structure

```
apps/
  hooks/      # Claude Code hook integration (single-file build)
  portal/     # GitHub Pages sharing portal
  marketing/  # Landing page
packages/
  editor/     # Main App.tsx + styles
  ui/         # Shared components, utils, types
```

## Development

```bash
bun install

# Run any app
bun run dev:hooks      # port 3000
bun run dev:portal     # port 3001
bun run dev:marketing  # port 3002
```

## Build

```bash
bun run build:hooks      # Single-file HTML for hook server
bun run build:portal     # Static build for GitHub Pages
bun run build:marketing  # Static build for marketing site
```

## Hook Integration

See `apps/hooks/shell/exit-plan-mode.sh` for the Claude Code hook script.

---

## License & Legal

**Copyright (c) 2025 backnotprop.**

This project is licensed under the **Business Source License 1.1 (BSL)**.
