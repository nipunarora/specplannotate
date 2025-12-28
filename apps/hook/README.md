# Plannotator Claude Code Plugin

This directory contains the Claude Code plugin configuration for Plannotator.

## Installation

### Step 1: Install the binary

```bash
npm install -g plannotator
```

### Step 2: Add the marketplace (in Claude Code)

```
/plugin marketplace add backnotprop/plannotator
```

### Step 3: Install the plugin (in Claude Code)

```
/plugin install plannotator@plannotator
```

## How It Works

When Claude Code calls `ExitPlanMode`, this hook intercepts and:

1. Opens Plannotator UI in your browser
2. Lets you annotate the plan visually
3. Approve → Claude proceeds with implementation
4. Request changes → Your annotations are sent back to Claude

## Manual Installation (Alternative)

If you prefer not to use the plugin system, add this to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "plannotator",
            "timeout": 1800
          }
        ]
      }
    ]
  }
}
```

## Development

The `server/` directory contains the source code for the Plannotator binary.
It's compiled and distributed via npm - see the root README for build instructions.
