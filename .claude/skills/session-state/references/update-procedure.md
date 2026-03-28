# Update Procedure

Update existing installation while preserving active session state.

## Pre-check

```bash
# Verify installation exists
ls -la .claude/session-state/current.md
```

If doesn't exist, use `/session-state install` instead.

## Update steps

### 1. Backup current session state

**CRITICAL:** Don't overwrite active work!

```bash
# Read current state
cat .claude/session-state/current.md
```

Store content in memory - you'll need to preserve this.

### 2. Update hook script reference

No files to copy - hooks reference script directly from skill folder.

Verify hooks configuration points to:
`bash $CLAUDE_PROJECT_DIR/.claude/skills/session-state/scripts/session-state-handler.sh`

### 3. Update hooks configuration

Read `.claude/settings.json` and update hooks section with latest configuration (same as install procedure).

Preserve other settings - only update the hooks section.

### 4. **DO NOT overwrite current.md**

Active `.claude/session-state/current.md` contains current work - preserve it!

Only update if user explicitly requests reset.

### 5. Preserve PR history

**DO NOT delete** `.claude/session-state/pr-*.md` files - these are historical records.

Auto-pruning (keeping last 5) happens only on new PR merges, not during updates.

### 6. Validate

```bash
/doctor
```

Check hooks configuration and script permissions.

## Expected outcome

```
Session state system updated successfully!

Updated files:
- .claude/settings.json (hooks section, if needed)
- Skill folder scripts and assets (source of truth)

Preserved:
- .claude/session-state/current.md (your active work)
- .claude/session-state/pr-*.md (PR history)

Hooks will use updated configuration on next tool use.
```

## What gets updated vs preserved

**Updated (skill folder - source of truth):**
- `.claude/skills/session-state/scripts/session-state-handler.sh` - Hook script
- `.claude/skills/session-state/assets/session-state-template.md` - Template
- `.claude/settings.json` hooks section - Hook configuration (if needed)

**Preserved (never overwrite):**
- `.claude/session-state/current.md` - Current active work
- `.claude/session-state/pr-*.md` - PR history files

## When to use update vs install

**Use update:**
- System already installed
- Want latest improvements
- Have active session state to preserve

**Use install:**
- First time setup
- Fresh project
- Want to reset everything
