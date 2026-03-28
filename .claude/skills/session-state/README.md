# Session State System - Claude Code Skill

Automatic working memory maintenance for Claude Code sessions using hooks.

## What This Skill Does

Preserves context across:
- Context compaction (when Claude's memory gets summarized)
- Session crashes or interruptions
- Long development sessions

**How it works:** 5 hooks fire automatically at critical moments, reminding Claude to update a working memory file (`.claude/session-state/current.md`). This file tracks your current task, decisions made, failed approaches, and next steps.

## Security First

**⚠️ Session state files are git-ignored by default for security.**

Session state is meant for active work sessions only, not permanent documentation or cross-machine sync.

**Never include:**
- API keys, passwords, tokens, credentials
- Customer names, emails, or PII
- Sensitive business logic or proprietary algorithms
- Database connection strings or infrastructure details

**Pattern detection** automatically scans for common secret patterns and warns if detected.

## Installation

1. **Copy this folder** to your project: `.claude/skills/session-state/`
2. **Run the install command:** `/session-state install`
3. **Start working** - hooks activate automatically

## Commands

- `/session-state install` - Set up in new project
- `/session-state update` - Update existing installation (preserves your active state)
- `/session-state status` - Check installation and validate configuration

## Architecture

**Skill folder** (portable, copy to other projects):
```
.claude/skills/session-state/
├── SKILL.md              # Main skill file
├── scripts/              # Hook handler
├── assets/               # Template files
├── references/           # Detailed procedures
└── README.md             # This file
```

**Working files** (created by install, git-ignored):
```
.claude/session-state/
├── current.md            # Active working state
└── pr-*.md               # PR archives (last 5)
```

## Key Features

- **5 hooks:** SessionStart, PreToolUse (every 10 uses), PreCompact (critical save), PostToolUse (PR detection), SessionEnd
- **PR-based archival:** Auto-archives to `pr-[number].md` when you merge PRs
- **Auto-pruning:** Keeps only last 5 PR archives
- **Pattern detection:** Warns about potential secrets
- **Progressive disclosure:** Lean main file + detailed references loaded on-demand

## For Active Sessions Only

Session state is **not** for:
- Cross-machine synchronization (use SPECIFICATIONS/ and REFERENCE/ for that)
- Permanent documentation (graduates to proper docs when PR merges)
- Long-term knowledge storage (that's what git history + docs are for)

Session state **is** for:
- Surviving context compaction during active work
- Recovering from crashes mid-session
- Maintaining working memory across breaks

## Documentation

- **Complete guide:** See project's `REFERENCE/session-state-system.md`
- **Security guidelines:** Comprehensive section in REFERENCE doc
- **Installation:** `references/install-procedure.md`
- **Troubleshooting:** `references/troubleshooting.md`
- **Hook details:** `references/hooks-reference.md`

## Experimental Status

This is a brand new system. Real usage will validate and refine the approach. Feedback welcome!

## License

Part of the useful-assets-template project.
