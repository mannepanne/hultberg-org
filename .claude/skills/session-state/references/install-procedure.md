# Install Procedure

Complete workflow for installing session state system in a project.

## Pre-check

```bash
# Check if already installed
ls -la .claude/session-state/current.md
```

If exists, suggest `/session-state update` instead.

## Installation steps

### 1. Create directory structure

```bash
mkdir -p .claude/hooks
```

### 2. Copy files from skill directory

```bash
# Create working directory
mkdir -p .claude/session-state
```

### 3. Configure hooks

Read existing `.claude/settings.json` and add hooks configuration:

**Note:** PostCompact is listed in official docs but CLI validation rejects it. Configure 5 hooks only.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash $CLAUDE_PROJECT_DIR/.claude/skills/session-state/scripts/session-state-handler.sh",
            "timeout": 10
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash $CLAUDE_PROJECT_DIR/.claude/skills/session-state/scripts/session-state-handler.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash $CLAUDE_PROJECT_DIR/.claude/skills/session-state/scripts/session-state-handler.sh",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash $CLAUDE_PROJECT_DIR/.claude/skills/session-state/scripts/session-state-handler.sh",
            "timeout": 10
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash $CLAUDE_PROJECT_DIR/.claude/skills/session-state/scripts/session-state-handler.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Preserve existing settings:** Merge hooks into existing configuration, don't replace entire file.

**PostCompact note:** If Edit tool rejects PostCompact (schema validation error), use bash to write settings.json directly. PostCompact exists in official docs but may not be in validation schema yet.

### 4. Initialize session state

```bash
# Create from template
cp .claude/skills/session-state/assets/session-state-template.md .claude/session-state/current.md
```

Update with current context:
- Set timestamp
- Set current branch
- Set session focus (e.g., "Session state system installed")

### 5. Validate

```bash
/doctor
```

Check for:
- Hook configuration errors
- Script permissions
- File paths

## Expected outcome

```
Session state system installed successfully!

Files created:
- .claude/session-state/current.md (working state)

Hooks configured (5 events):
- SessionStart, PreToolUse, PreCompact, PostToolUse, SessionEnd
- All reference script from skill folder: .claude/skills/session-state/scripts/
- Note: PostCompact in docs but CLI validation rejects it

⚠️  SECURITY REMINDER:
   Session state is git-ignored by default (see .gitignore).
   Do NOT include API keys, passwords, PII, or sensitive business data.
   Pattern detection warns about potential secrets at SessionEnd.
   See REFERENCE/session-state-system.md for complete security guidelines.

Check .claude/session-state/current.md to track your work.
Hooks will activate on next tool use.
```

## Next steps

1. Start working - hooks fire automatically
2. SessionStart will fire when you use first tool
3. PreToolUse reminds every 10 tool uses
4. PreCompact critical - save before compaction (includes "re-read after" reminder)
