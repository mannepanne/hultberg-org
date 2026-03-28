# Troubleshooting

Common issues and solutions for session state system.

## Hook doesn't fire

**Symptom:** Expected hook reminder doesn't appear

**Diagnosis:**
```bash
# Check hooks configured
grep -A 20 '"hooks"' .claude/settings.json

# Check script exists
ls -la .claude/skills/session-state/scripts/session-state-handler.sh

# Validate with /doctor
/doctor
```

**Common causes:**

1. **Invalid JSON in settings.json**
   - Check for trailing commas
   - Validate JSON syntax
   - Run `/doctor` to identify errors

3. **Wrong event name**
   - Valid events: SessionStart, PreToolUse, PreCompact, PostCompact, PostToolUse, SessionEnd
   - Check spelling and capitalization

4. **Script path incorrect**
   - Must use `$CLAUDE_PROJECT_DIR/.claude/skills/session-state/scripts/session-state-handler.sh`
   - Check path matches actual skill folder location

5. **Hook timeout too short**
   - Increase timeout if script takes longer than configured
   - Recommended: 10s for SessionStart/PreCompact/PostCompact, 5s for others

## State not updating

**Symptom:** Session state file doesn't reflect recent work

**Diagnosis:**
```bash
# Check when last modified
ls -la .claude/session-state/current.md

# Compare with recent tool uses
# (hooks should have reminded you)
```

**Common causes:**

1. **Not responding to hook reminders**
   - PreToolUse fires every 10 tool uses - update when reminded
   - PreCompact is CRITICAL - always update immediately

2. **File permissions**
   ```bash
   # Check writable
   ls -la .claude/session-state/current.md

   # Fix if needed
   chmod 644 .claude/session-state/current.md
   ```

3. **Wrong file path**
   - File should be `.claude/session-state/current.md` in project root
   - Not in subdirectory or different location

## PostCompact validation

**Symptom:** Edit tool rejects PostCompact hook configuration

**Error message:**
```
PostCompact is not valid. Expected one of: PreToolUse, PostToolUse...
```

**Why this happens:**
- PostCompact exists in official docs
- Schema validation may not include it yet
- Version mismatch or documentation ahead of implementation

**Workaround:**
```bash
# Write settings.json with bash (bypasses validation)
cat > .claude/settings.json << 'EOF'
{
  "hooks": {
    "PostCompact": [...]
  }
}
EOF
```

**Validation after:**
```bash
# Check syntax
/doctor

# Test manually
# (PostCompact fires after context compaction)
```

**Belt-and-suspenders approach:**
- PreCompact reminder already says "re-read after compaction"
- Even if PostCompact fails, PreCompact message covers it

## Context loss

**Symptom:** After compaction, Claude lost awareness of current work

**Diagnosis:**
1. Check if current.md was updated before compaction
2. Check if PostCompact hook fired (should remind to re-read)
3. Read current.md - does it contain current context?

**Common causes:**

1. **PreCompact reminder ignored**
   - **Critical:** Always update state when PreCompact fires
   - This is the primary defense against context loss

2. **State update incomplete**
   - Must capture: current task, decisions, failed approaches, next action
   - Not just "work in progress" - specific details needed

3. **PostCompact not restoring**
   - Should automatically remind to re-read state
   - If hook didn't fire, manually read session-state.md

**Recovery:**
```bash
# Read current state
cat .claude/session-state/current.md

# Check git for recent changes
git status
git diff
git log -5 --oneline

# Check recent commits for context
git log -p -3
```

**Prevention:**
- Honor PreCompact hook religiously
- Update state after meaningful work chunks
- Be specific in "Context for next session" field
- Capture "Next action" clearly

## PR archival not working

**Symptom:** After `gh pr merge`, session state not archived

**Diagnosis:**
```bash
# Check if PostToolUse hook configured for Bash
grep -A 10 '"PostToolUse"' .claude/settings.json

# Check hook script detects PR merge
bash .claude/hooks/session-state-handler.sh
# (manually set HOOK_EVENT=PostToolUse, COMMAND="gh pr merge 123")
```

**Common causes:**

1. **PostToolUse not configured**
   - Must have matcher: `"Bash"`
   - Must call session-state-handler.sh

2. **PR number extraction failed**
   ```bash
   # Test extraction
   git log -1 --oneline | grep -o '#[0-9]*'
   ```
   - Requires merge commit with "#123" format
   - GitHub CLI `gh pr merge` creates this automatically

3. **Manual archival needed**
   ```bash
   # Get PR number
   PR_NUM=$(git log -1 --oneline | grep -o '#[0-9]*' | tr -d '#')

   # Create archive
   cp .claude/session-state/current.md .claude/.claude/session-state/pr-${PR_NUM}.md

   # Simplify (remove ephemeral sections)
   # Edit .claude/session-state/pr-${PR_NUM}.md manually

   # Reset state
   cp .claude/session-state-template.md .claude/session-state/current.md

   # Update with fresh context
   ```

## Missing jq dependency

**Symptom:** Hook script errors mentioning `jq`

**Solution:**

**macOS:**
```bash
brew install jq
```

**Linux (Debian/Ubuntu):**
```bash
apt-get install jq
```

**Linux (RHEL/Fedora):**
```bash
yum install jq
```

**Verify:**
```bash
which jq
jq --version
```

## State file disappeared

**Symptom:** `.claude/session-state/current.md` doesn't exist

**Recovery:**
```bash
# Recreate from template
cp .claude/session-state-template.md .claude/session-state/current.md

# Initialize with current context
# Edit session-state.md to add:
# - Current branch
# - Current task
# - Recent work
```

**Check git history:**
```bash
# Was it deleted?
git log --all --full-history -- .claude/session-state/current.md

# Restore from git if needed
git checkout <commit> -- .claude/session-state/current.md
```

**Prevention:**
- Session state should be committed to git
- Not in .gitignore
- Frontmatter explains ephemeral nature

## Too many PR archives

**Symptom:** More than 5 `.claude/session-state/pr-*.md` files

**Auto-pruning should handle this** when new PR merges. If not:

```bash
# Manual cleanup (keep last 5)
ls .claude/.claude/session-state/pr-*.md | sort -V | head -n -5 | xargs rm

# Verify
ls .claude/.claude/session-state/pr-*.md
```

## Hook fires but no action

**Symptom:** See hook message but Claude doesn't respond

**This is expected behavior:**
- Hooks are reminders, not commands
- Claude decides when to act
- PreToolUse every 10 uses is gentle nudge
- PreCompact is urgent - should always act

**If Claude ignores PreCompact:**
- Check if context compaction actually happening
- Verify hook message content is clear
- May need to manually update state

## Getting help

**Diagnostic checklist:**
```bash
# 1. Check installation
ls -la .claude/session-state-template.md
ls -la .claude/hooks/session-state-handler.sh
ls -la .claude/session-state/current.md

# 2. Check permissions
ls -la .claude/hooks/session-state-handler.sh | grep -q 'x' && echo "Executable" || echo "NOT executable"

# 3. Check configuration
/doctor

# 4. Check dependencies
which jq

# 5. Check recent hook activity
# (look for "=== SESSION STATE:" messages in conversation)
```

**Run `/session-state status`** for comprehensive system check.

**If issue persists:**
- Document exact symptoms
- Include diagnostic output
- Note when issue started
- Check if recent changes to settings.json or hook script
