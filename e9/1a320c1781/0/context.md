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

[Request interrupted by user]

### Prompt 3

I don't feel confident the /review-pr skill actually gets all the relevant context before the reviewer starts. When I ran it now it didn't look for @CLAUDE.md where the basics of the project is explained, nor did it look for @SPECIFICATIONS/testing-strategy-plan.md which is the plan that is critical for the PR to review. Why is that? How can it be improved?

### Prompt 4

Just to make sure: we don't want to hard code these specific documents in the skill, we want it to work for future features as well. And the reviewer might not need to read ALL those documents, the focus should be on just enough context that is required for a good review.

Is this how you see it too?

I am thinking something like an approach where @CLAUDE.md always is read (because that's the basics), then read the PR to be reviewed (title and content), then do a listing of all files in @SPECIFI...

### Prompt 5

Update both skills please, this sounds spot on.

