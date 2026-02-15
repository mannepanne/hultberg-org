# Session Context

## User Prompts

### Prompt 1

Base directory for this skill: /Users/magnus/Documents/Coding/MigrateHultbergOrg/hultberg-org/.claude/skills/review-pr-team

# Multi-Perspective PR Review

This skill provides comprehensive pull request review from three specialized perspectives:
1. **Security Reviewer** - Authentication, secrets, XSS, CSRF, input validation, SQL injection
2. **Product Manager** - Business value, market and customer fit, user experience, features, edge cases, requirements alignment
3. **Senior Architect** - Desi...

### Prompt 2

Ok! Can you take a look at the latest comment from the three reviewers, and we can discuss how to address the findings.

### Prompt 3

Let's do option B.

On the questions:

1. I am ok with the latency, make sure this decision is pointed out in the documentation to avoid it being mentioned again in future reviews.
2. Auto polling every 30s, and showing some visual indication that it's going on please.
3. Yes, I am ok with immmutable slugs.
4. Option B please.

### Prompt 4

I think we're good to commit.

