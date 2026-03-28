# PR Archive Format

Format for `.claude/session-state/pr-[number].md` files created when PRs merge.

## Purpose

Archive key decisions and context from completed work without maintaining full session detail.

## File naming

`.claude/session-state/pr-[number].md` where `[number]` is the PR number from merge commit.

**Example:** `.claude/session-state/pr-123.md` for PR #123

## Template structure

```markdown
# PR #[number]: [Brief title]

**Merged:** [Date]
**Branch:** [feature-branch-name]

## What changed

[2-3 sentence summary of what was implemented]

## Key decisions

**[Decision topic]:**
- Choice: [What was decided]
- Reasoning: [Why this approach]

[Repeat for 2-3 most important decisions]

## Failed approaches

- **[Approach]:** [Why it didn't work]

[Only include if relevant]

## Notes for future

[Any context that might be useful when working on related features]

---

*Archived from .claude/session-state/current.md on PR merge*
```

## What to include

**Include:**
- High-level summary of changes
- Architectural decisions and reasoning
- Failed approaches worth remembering
- Context for future related work

**Exclude:**
- Detailed task lists
- Uncommitted changes tracking
- Session-specific blockers
- Temporary notes

## Auto-pruning

System keeps last 5 archives. Older files deleted automatically on new PR merge.

**Pruning happens in:**
- PostToolUse hook after `gh pr merge` detection
- Sorted by PR number (not date)
- Deletes lowest numbered files beyond 5

## Manual creation

If auto-archive fails, create manually:

```bash
# Extract PR number from recent merge
git log -1 --oneline | grep -o '#[0-9]*'

# Create archive
cp .claude/session-state/current.md .claude/.claude/session-state/pr-[number].md

# Edit to simplify (remove ephemeral sections)
# Reset session-state.md from template
cp .claude/session-state-template.md .claude/session-state/current.md
```

## Reading archives

**Find specific PR:**
```bash
cat .claude/.claude/session-state/pr-123.md
```

**List all archives:**
```bash
ls -lht .claude/.claude/session-state/pr-*.md
```

**Recent context:**
```bash
# Last 3 PRs
ls .claude/.claude/session-state/pr-*.md | sort -V | tail -3 | xargs cat
```

## Integration with session state

Archives populate "Recent PR history" section in current.md:

```markdown
## Recent PR history

- **PR #125** (pr-125.md) (2026-03-20): Added dark mode toggle
- **PR #124** (pr-124.md) (2026-03-18): Refactored authentication flow
- **PR #123** (pr-123.md) (2026-03-15): Implemented user preferences
```

Updated automatically by PostToolUse hook on merge.
