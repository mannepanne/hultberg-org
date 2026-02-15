# Session Context

## User Prompts

### Prompt 1

Base directory for this skill: /Users/magnus/Documents/Coding/MigrateHultbergOrg/hultberg-org/.claude/skills/review-pr

# Full-Stack Developer PR Review

This skill provides a comprehensive pull request review from an experienced full-stack developer perspective, covering code quality, security, functionality, and best practices.

## How This Works

A single expert full-stack developer reviews the PR and provides actionable feedback.

---

## Instructions for Claude

When this skill is invoked w...

### Prompt 2

Great! Before we do anything else, explain something to me. When I now look in my filesystem, I can't see the SPECIFICATIONS folder, and I can't see the skills folder in .claude. What is going on? Is this a branching problem?

### Prompt 3

Hmm... Ok, sounds like we need to ditch all the recent work, get back to where we had finished up the specificaitons and the /review-pr-team skill, and start over from there... Please help me figure this out!

### Prompt 4

Ok! Thanks! Before we do anything else, please create the skill for a single senior full stack developer reviewing a PR. Copy the /review-pr-team and call the new skill /review-pr

I think that was a really good idea for reviewing development work.

### Prompt 5

Yes please, commit it.

### Prompt 6

Please make sure that  both the PR review skills also references @CLAUDE.md for context, since we decided to put information suitable for a new developer coming new to the project in that file. And then make sure @CLAUDE.md is suitable for that person, covering all the details a developer needs to know quickly get up to speed.

