# Status Check Procedure

Diagnose session state installation and validate configuration.

## Check installation

```bash
# Skill folder exists?
ls -la .claude/skills/session-state/

# Session state directory exists?
ls -la .claude/session-state/

# Current state exists?
ls -la .claude/session-state/current.md

# Hooks configured?
grep -q '"SessionStart"' .claude/settings.json
```

## Check PR history

```bash
# Count archived PRs
ls .claude/session-state/pr-*.md 2>/dev/null | wc -l

# List with dates
ls -lht .claude/session-state/pr-*.md 2>/dev/null
```

## Validate configuration

```bash
# Run Claude Code doctor
/doctor
```

Look for:
- Hook configuration errors
- Invalid hook event names
- Syntax errors in settings.json

## Check hook script

```bash
# Validate bash syntax
bash -n .claude/skills/session-state/scripts/session-state-handler.sh

# Check jq available (required for hook script)
which jq
```

## Status report template

```markdown
Session State System Status:

Installation: ✅ Installed / ❌ Not Installed
  - Skill folder: ✅/❌ .claude/skills/session-state/
  - Working directory: ✅/❌ .claude/session-state/
  - Current state: ✅/❌ .claude/session-state/current.md
  - Hooks configured: ✅/❌ 6 events

PR History: [N] archived PRs
  - pr-123.md (2026-03-20)
  - pr-122.md (2026-03-18)
  - [etc...]

Configuration: ✅ Valid / ❌ Errors found
  - /doctor output: [No errors / Errors listed below]

Dependencies:
  - jq: ✅ Installed / ❌ Missing

System ready: ✅/❌
```

## Common status scenarios

**Fully installed and working:**
```
Installation: ✅
PR History: 3 archived PRs
Configuration: ✅ Valid
System ready: ✅
```

**Partially installed:**
```
Installation: ❌ Incomplete
  - Skill folder: ✅
  - Working directory: ❌ Missing
Recommend: Run /session-state install
```

**Configuration errors:**
```
Installation: ✅
Configuration: ❌ Errors found
  - PostCompact hook validation failed
Recommend: Check settings.json, may need bash workaround for PostCompact
```

**Missing dependencies:**
```
Dependencies:
  - jq: ❌ Missing

Recommend: Install jq
- macOS: brew install jq
- Linux: apt-get install jq
```

## Next steps based on status

- **Not installed:** Run `/session-state install`
- **Incomplete:** Run `/session-state install` (will complete missing parts)
- **Configuration errors:** Check `/doctor` output, fix settings.json
- **Missing jq:** Install jq for your platform
- **Fully working:** System operational, monitor hook behavior
