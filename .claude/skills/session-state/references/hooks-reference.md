# Hooks Reference

Complete details on all 5 hooks in the session state system.

**Note:** PostCompact is listed in [official docs](https://code.claude.com/docs/en/hooks) but CLI validation rejects it as of March 2026. Using 5 hooks with belt-and-suspenders approach: PreCompact reminder includes "re-read after compaction."

## Hook events

### SessionStart

**When:** First tool use in new session

**Purpose:** Validate state exists, understand current context

**Reminder message:**
```
=== SESSION STATE: SESSION START ===
ACTION: Read .claude/session-state/current.md to understand current context.
Git status follows for branch/changes awareness.
```

**What to do:**
1. Read session-state.md to understand current work
2. Note current branch from git status
3. Check Recent PR history for context
4. Resume work from "Next action" field

### PreToolUse

**When:** Every 10 tool uses (Read, Edit, Write, Bash)

**Purpose:** Gentle reminder to update session state periodically

**Reminder message:**
```
=== SESSION STATE: UPDATE REMINDER ===
Consider updating .claude/session-state/current.md if work completed.
[Tool count: X]
```

**What to do:**
- Update "Work completed this session" if you finished something
- Add to "Decisions made" if you made choices
- Update "Failed approaches" if something didn't work
- Update "Next action" if priorities changed

**Not required every time** - only when meaningful work happened.

### PreCompact

**When:** Before context compaction (triggered automatically by system)

**Purpose:** **CRITICAL** - Save state before losing context

**Reminder message:**
```
=== SESSION STATE: CRITICAL - CONTEXT COMPACTION WARNING ===
Context compaction imminent. You MUST update session state NOW.

ACTION: Use Edit tool to update .claude/session-state/current.md NOW.

Update these sections:
- Current task (status, next action)
- Work completed this session
- Decisions made
- Failed approaches
- Uncommitted changes
- Context for next session

IMPORTANT: After compaction completes, immediately re-read
.claude/session-state/current.md to restore the context you just saved.
```

**What to do:**
1. **IMMEDIATELY** update session-state.md with current context
2. Capture ALL important decisions and progress
3. Note what you were about to do next
4. After compaction: re-read session-state.md (belt-and-suspenders)

**This is the most critical hook** - context loss prevention depends on it.

### PostCompact (NOT AVAILABLE IN CLI)

**Status:** Listed in [official docs](https://code.claude.com/docs/en/hooks) but CLI validation rejects it as of March 2026.

**What it would do:** Read session-state/current.md after compaction to restore context.

**Workaround:** PreCompact reminder includes explicit instruction:
```
IMPORTANT: After compaction completes, immediately re-read
.claude/session-state/current.md to restore the context you just saved.
```

**Manual steps after compaction:**
1. Read session-state/current.md to restore working memory
2. Note current task and next action
3. Continue work from where you left off

**Future:** Hook script has PostCompact handler ready - just waiting for CLI validation support.

### PostToolUse

**When:** After Bash commands complete

**Purpose:** Detect PR merges for automatic archival

**Triggers on:** `gh pr merge` command detection

**Reminder message:**
```
=== SESSION STATE: PR MERGE DETECTED ===
A PR has been merged. Archive current session state.

Steps:
1. Extract PR number from merge commit
2. Create .claude/session-state/pr-[number].md with simplified summary
3. Reset session-state.md from template
4. Prune old archives (keep last 5)
5. Update session-state.md with new PR in history
```

**What to do:**
1. Extract PR number: `git log -1 --oneline | grep -o '#[0-9]*'`
2. Create simplified archive from current session-state.md
3. Copy template to reset: `cp .claude/session-state-template.md .claude/session-state/current.md`
4. Delete oldest archives if more than 5 exist
5. Update "Recent PR history" section with new entry

**Archive format:** See [pr-archive-format.md](pr-archive-format.md)

### SessionEnd

**When:** Session terminates (explicit /exit or crash)

**Purpose:** Final state update opportunity

**Reminder message:**
```
=== SESSION STATE: SESSION END ===
Session ending. Final chance to update .claude/session-state/current.md.
```

**What to do:**
- Quick final update if needed
- Ensure "Context for next session" is clear
- Note any blockers or next steps

## Hook configuration

All hooks configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "bash $CLAUDE_PROJECT_DIR/.claude/hooks/session-state-handler.sh",
        "timeout": 10
      }]
    }],
    "PreToolUse": [{
      "matcher": "Read|Edit|Write|Bash",
      "hooks": [{
        "type": "command",
        "command": "bash $CLAUDE_PROJECT_DIR/.claude/hooks/session-state-handler.sh",
        "timeout": 5
      }]
    }],
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "bash $CLAUDE_PROJECT_DIR/.claude/hooks/session-state-handler.sh",
        "timeout": 10
      }]
    }],
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "bash $CLAUDE_PROJECT_DIR/.claude/hooks/session-state-handler.sh",
        "timeout": 10
      }]
    }],
    "SessionEnd": [{
      "hooks": [{
        "type": "command",
        "command": "bash $CLAUDE_PROJECT_DIR/.claude/hooks/session-state-handler.sh",
        "timeout": 10
      }]
    }]
  }
}
```

## Hook script logic

All hooks handled by `.claude/skills/session-state/scripts/session-state-handler.sh`

**Environment variables available:**
- `$HOOK_EVENT` - Event name (SessionStart, PreToolUse, etc.)
- `$TOOL_NAME` - Tool being used (for PreToolUse/PostToolUse)
- `$COMMAND` - Command being run (for Bash tool)
- `$CLAUDE_PROJECT_DIR` - Project root path

**Script tracks:**
- Tool use count (for every-10-uses reminder)
- PR merge detection
- Git status for context

## Matchers

**PreToolUse matcher:** `"Read|Edit|Write|Bash"`
- Only triggers on file operations and bash commands
- Avoids noise from other tools
- Counts toward 10-use reminder

**PostToolUse matcher:** `"Bash"`
- Only watches bash commands
- Specifically looks for `gh pr merge`
- Triggers archival workflow

## Timeouts

- **SessionStart/PreCompact/SessionEnd:** 10 seconds
- **PreToolUse/PostToolUse:** 5 seconds

Hooks that take too long will be killed by Claude Code.

## Best practices

**Do:**
- Always honour PreCompact - this is critical
- Update state after meaningful work chunks
- Be specific in "Next action" field
- Capture failed approaches immediately

**Don't:**
- Ignore PreCompact warning (context loss risk)
- Wait too long between updates
- Overthink PreToolUse reminders (quick updates fine)
- Skip archival when PR merges

## Experimental notes

**PostCompact not available:**
- Official docs list PostCompact but CLI validation rejects it (March 2026)
- Cannot be added to settings.json - blocks Claude Code startup
- Solution: PreCompact reminder explicitly says "re-read after compaction"
- Hook script has PostCompact handler ready for when CLI supports it

**This system is experimental** - real usage may reveal needed improvements.
