#!/bin/bash
# Session state validation and reminder hook
#
# This SCRIPT is read-only - it validates and outputs reminders to Claude.
# CLAUDE is expected to update session-state.md using the Edit tool when prompted.
#
# The script doesn't modify files because bash can't understand work context.
# Claude receives the output as context and makes intelligent updates.

set -euo pipefail

# Read hook event from stdin JSON
EVENT_JSON=$(cat)
HOOK_EVENT=$(echo "$EVENT_JSON" | jq -r '.hook_event_name // "unknown"')
SESSION_FILE="$CLAUDE_PROJECT_DIR/.claude/session-state/current.md"
TOOL_COUNT_FILE="/tmp/claude-session-state-tool-count-$$"

# ============================================================================
# Security: Scan session state for potential secrets or sensitive data
# ============================================================================
scan_for_sensitive_content() {
  if [ ! -f "$SESSION_FILE" ]; then
    return 0
  fi

  local warnings=()

  # Pattern detection (case-insensitive)
  if grep -iq -E '(api[_-]?key|apikey)[[:space:]]*[:=]' "$SESSION_FILE"; then
    warnings+=("Potential API key pattern detected")
  fi

  if grep -iq -E '(password|passwd|pwd)[[:space:]]*[:=]' "$SESSION_FILE"; then
    warnings+=("Potential password pattern detected")
  fi

  if grep -iq -E '(secret|token|bearer)[[:space:]]*[:=]' "$SESSION_FILE"; then
    warnings+=("Potential secret/token pattern detected")
  fi

  if grep -iq -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' "$SESSION_FILE"; then
    warnings+=("Email address detected (potential PII)")
  fi

  if grep -iq -E '(sk|pk)_[a-z]{4,}_[a-zA-Z0-9]{20,}' "$SESSION_FILE"; then
    warnings+=("Stripe-like key pattern detected")
  fi

  if grep -iq -E 'ghp_[a-zA-Z0-9]{36}' "$SESSION_FILE"; then
    warnings+=("GitHub personal access token pattern detected")
  fi

  if grep -iq -E 'AKIA[0-9A-Z]{16}' "$SESSION_FILE"; then
    warnings+=("AWS access key pattern detected")
  fi

  # Report warnings if any found
  if [ ${#warnings[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  SECURITY WARNING - Potential sensitive content detected:"
    for warning in "${warnings[@]}"; do
      echo "   - $warning"
    done
    echo ""
    echo "Review .claude/session-state/current.md before committing to git."
    echo "Remember: Session state is git-ignored by default for security."
    echo ""
    return 1
  fi

  return 0
}

# ============================================================================
# SessionStart: Validate state exists and show current context
# ============================================================================
if [ "$HOOK_EVENT" = "SessionStart" ]; then
  # Initialize tool count for this session
  echo "0" > "$TOOL_COUNT_FILE"

  # Validate session state exists
  if [ ! -f "$SESSION_FILE" ]; then
    echo "=== SESSION STATE: FILE MISSING ==="
    echo "WARNING: .claude/session-state/current.md does not exist!"
    echo ""
    echo "ACTION REQUIRED:"
    echo "Create current.md from template before proceeding."
    echo "Template: .claude/skills/session-state/assets/session-state-template.md"
    echo "=== END SESSION STATE WARNING ==="
    exit 0
  fi

  # Get current git status
  cd "$CLAUDE_PROJECT_DIR"
  GIT_AVAILABLE=true
  GIT_STATUS=$(git status --porcelain 2>/dev/null) || GIT_AVAILABLE=false
  GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

  # Output context for Claude
  echo "=== SESSION STATE: SESSION START ==="
  echo "Session state file: $SESSION_FILE (exists)"
  echo "Git branch: $GIT_BRANCH"
  echo ""

  if [ "$GIT_AVAILABLE" = false ]; then
    echo "NOTE: Git is not available in this environment."
  elif [ -n "$GIT_STATUS" ]; then
    echo "Git working tree has uncommitted changes:"
    echo "$GIT_STATUS"
    echo ""
    echo "REMINDER: Read session-state.md and verify it reflects current state."
    echo "Ask user for clarification if there are discrepancies."
  else
    echo "Git working tree is clean."
  fi

  echo ""
  echo "ACTION: Read .claude/session-state/current.md to understand current context."
  echo "=== END SESSION STATE ==="
  exit 0

# ============================================================================
# PreToolUse: Periodic reminder to update state (every 10 tool uses)
# ============================================================================
elif [ "$HOOK_EVENT" = "PreToolUse" ]; then
  # Track tool usage count
  if [ -f "$TOOL_COUNT_FILE" ]; then
    TOOL_COUNT=$(cat "$TOOL_COUNT_FILE")
  else
    TOOL_COUNT=0
  fi

  # Increment count
  NEW_COUNT=$((TOOL_COUNT + 1))
  echo "$NEW_COUNT" > "$TOOL_COUNT_FILE"

  # Only output reminder every 10 uses
  if [ $((NEW_COUNT % 10)) -eq 0 ]; then
    echo "=== SESSION STATE: UPDATE REMINDER ==="
    echo "Consider updating .claude/session-state/current.md if work completed."
    echo "=== END SESSION STATE ==="
  fi
  exit 0

# ============================================================================
# PreCompact: CRITICAL - Save context before compaction
# ============================================================================
elif [ "$HOOK_EVENT" = "PreCompact" ]; then
  echo "=== SESSION STATE: CRITICAL - CONTEXT COMPACTION WARNING ==="
  echo ""
  echo "Context compaction is imminent. UPDATE SESSION STATE NOW."
  echo ""
  echo "Checklist - What to save in .claude/session-state/current.md:"
  echo "  [ ] Current task status and next action"
  echo "  [ ] Work completed this session"
  echo "  [ ] Decisions made and reasoning"
  echo "  [ ] Failed approaches tried (prevent retry loops)"
  echo "  [ ] Uncommitted changes and why"
  echo "  [ ] Any blockers or issues"
  echo ""
  echo "ACTION: Use Edit tool to update .claude/session-state/current.md NOW."
  echo "This is your last chance before context is lost."
  echo ""
  echo "IMPORTANT: After compaction completes, immediately re-read"
  echo ".claude/session-state/current.md to restore the context you just saved."
  echo ""
  echo "=== END COMPACTION WARNING ==="
  exit 0

# ============================================================================
# PostCompact: Read state back in after compaction
# ============================================================================
elif [ "$HOOK_EVENT" = "PostCompact" ]; then
  echo "=== SESSION STATE: CONTEXT RESTORED ==="
  echo ""
  echo "Context compaction just completed."
  echo ""
  echo "ACTION: Read .claude/session-state/current.md to restore context."
  echo ""
  echo "Review:"
  echo "  - Current task and next action"
  echo "  - Recent decisions made"
  echo "  - Failed approaches to avoid"
  echo "  - Any blockers"
  echo ""
  echo "This restores the context you saved in PreCompact."
  echo "=== END CONTEXT RESTORE ==="
  exit 0

# ============================================================================
# PostToolUse: Detect PR merge and trigger archival
# ============================================================================
elif [ "$HOOK_EVENT" = "PostToolUse" ]; then
  # Extract the command from tool_input
  COMMAND=$(echo "$EVENT_JSON" | jq -r '.tool_input.command // ""')

  # Only trigger for gh pr merge commands
  if echo "$COMMAND" | grep -q "gh pr merge"; then
    echo "=== SESSION STATE: PR MERGE DETECTED ==="
    echo ""
    echo "A PR merge was just completed. Archive current session state."
    echo ""
    echo "ACTIONS REQUIRED:"
    echo "1. Get PR number:"
    echo "   - Run: git log -1 --format=%s"
    echo "   - Extract number from 'Merge pull request #123' format"
    echo "   - If extraction fails, ask user for PR number"
    echo ""
    echo "2. Archive current session state:"
    echo "   - Read .claude/session-state/current.md"
    echo "   - Create .claude/session-state/pr-[number].md with summary format:"
    echo "     * PR title, date, branch, GitHub link"
    echo "     * 2-3 sentence summary of what was built"
    echo "     * Key decisions made"
    echo "     * Files changed (brief)"
    echo "     * What's next"
    echo ""
    echo "3. Reset session state:"
    echo "   - Copy .claude/skills/session-state/assets/session-state-template.md"
    echo "   - To .claude/session-state/current.md"
    echo "   - Update PR history section with link to new pr-[number].md"
    echo ""
    echo "4. Prune old history:"
    echo "   - Keep only last 5 .claude/session-state/pr-*.md files"
    echo "   - Delete older ones"
    echo ""
    echo "=== END PR MERGE HANDLER ==="
  fi
  exit 0

# ============================================================================
# SessionEnd: Finalize state for next session
# ============================================================================
elif [ "$HOOK_EVENT" = "SessionEnd" ]; then
  # Clean up tool count file
  rm -f "$TOOL_COUNT_FILE"

  echo "=== SESSION STATE: SESSION END ==="
  echo "Before ending this session, ensure you have:"
  echo ""
  echo "1. Updated .claude/session-state/current.md with:"
  echo "   - Current task status"
  echo "   - Work completed"
  echo "   - Any decisions made"
  echo "   - Next action for resuming"
  echo ""
  echo "2. Committed any working code (if applicable)"
  echo ""
  echo "3. Noted any blockers or context needed for next session"
  echo ""

  # Security scan for sensitive content
  scan_for_sensitive_content || true  # Don't block on warnings

  echo "=== END SESSION STATE ==="
  exit 0
fi

exit 0
