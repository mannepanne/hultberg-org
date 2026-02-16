---
name: review-pr
description: Full-Stack Developer PR Review
disable-model-invocation: true
user-invocable: true
argument-hint:
  - PR-number
---
# Full-Stack Developer PR Review

This skill provides a comprehensive pull request review from an experienced full-stack developer perspective, covering code quality, security, functionality, and best practices.

## How This Works

A single expert full-stack developer reviews the PR and provides actionable feedback.

---

## Instructions for Claude

When this skill is invoked with a PR number (e.g., `/review-pr 2`):

### Step 1: Fetch PR Context

Use GitHub CLI to gather PR information:

```bash
gh pr view $ARGUMENTS
gh pr diff $ARGUMENTS
gh pr view $ARGUMENTS --comments
```

Review the files changed, commit messages, and any existing comments.

---

### Step 2: Gather Project and Specification Context

Before reviewing, gather context about the project and any related specifications:

1. **Read project documentation** - Read `CLAUDE.md` in the repository root to understand:
  - Project architecture and structure
  - Development workflow and commands
  - Key conventions and patterns
  - Technology stack and dependencies

2. **Check PR description and commits** for references to specification files

3. **Look in SPECIFICATIONS/** directory for relevant docs

4. **Read specification files** to understand:
  - Feature requirements and goals
  - Security requirements (if security spec exists)
  - Implementation approach (if implementation plan exists)
  - Success criteria

**Common specification patterns:**
- Main spec: `SPECIFICATIONS/*-plan.md` or `SPECIFICATIONS/*-mvp.md` or `SPECIFICATIONS/requirements.md`
- Security: `SPECIFICATIONS/*-security.md`
- Implementation: `SPECIFICATIONS/*-implementation.md`

**Create a context summary** including:
- Project architecture (from CLAUDE.md)
- What is this PR supposed to achieve?
- What are the key requirements?
- What security measures were specified?
- What architectural decisions were made?

This context will be provided to the reviewer so they can evaluate whether the PR matches the project architecture and intended design.

**If no specifications found:** Reviewer will evaluate based on project architecture (from CLAUDE.md) and best practices.

---

### Step 3: Full-Stack Developer Review

Spawn a **general-purpose** subagent with this task:

**Task:** "Act as an experienced full-stack developer reviewing PR #$ARGUMENTS.

**Project Context:**
[Paste the context summary from Step 2, including project architecture from CLAUDE.md, requirements, and architectural decisions]

Review this PR comprehensively across all dimensions:

**Code Quality:**
- Is the code readable and maintainable?
- Appropriate naming conventions?
- Proper error handling?
- Code organization and structure?
- Comments where needed (but not over-commented)?

**Functionality:**
- Does this implement the requirements correctly?
- Are there bugs or logical errors?
- Edge cases handled?
- Does it actually work as intended?

**Security:**
- Any security vulnerabilities? (XSS, injection, auth bypass, etc.)
- Secrets properly managed?
- Input validation adequate?
- Authentication/authorization correct?

**Architecture & Design:**
- Fits well with existing codebase?
- Design patterns used appropriately?
- Not over-engineered or under-engineered?
- Future extensibility considered?

**Performance:**
- Any obvious performance issues?
- Appropriate use of caching?
- Database queries optimized (if applicable)?
- Resource usage reasonable?

**Testing:**
- Are tests included (if needed)?
- Test coverage adequate?
- Tests actually test the right things?

**TypeScript/Types:**
- Proper use of types (no `any` unless necessary)?
- Type safety maintained?
- Interfaces/types well-defined?

**Best Practices:**
- Follows project conventions?
- No deprecated patterns?
- Dependencies appropriate and up-to-date?
- Breaking changes documented?

**Output Format:**
- ✅ **Well Done**: What's good about this PR
- 🔴 **Critical Issues**: Must fix before merge (blocking)
- ⚠️ **Suggestions**: Should consider (not blocking)
- 💡 **Nice-to-Haves**: Optional improvements

Be specific with file:line references. Be practical and pragmatic - focus on issues that actually matter. Don't be pedantic about minor style issues if the code is otherwise solid."

Wait for the review to complete.

---

### Step 4: Post Results

After the review is complete:

Post the review as a comment on the PR using:

```bash
gh pr comment $ARGUMENTS --body "[markdown content from review]"
```

Provide user summary:
- Total issues found (critical vs suggestions)
- Clear recommendation (approve/request changes)
- Key action items
- Link to PR comment

---

## Example Usage

```
/review-pr 2
```

This will:
1. Fetch PR #2 details
2. Run full-stack developer review
3. Post comprehensive review to PR #2

---

## Tips for Best Results

- **Use for all implementation PRs** - Quick sanity check
- **Faster than multi-perspective** - ~1-2 minutes vs 3-5 minutes
- **Broad coverage** - Catches most common issues
- **Upgrade to /review-pr-team** - For critical/complex PRs needing deep analysis

---

## When to Use Which Review

**Use \****`/review-pr`**\*\*:**
- Regular implementation PRs
- Quick sanity checks
- You want fast feedback
- Standard feature work

**Use \****`/review-pr-team`**\*\*:**
- Critical infrastructure changes
- Security-sensitive features
- Major architectural decisions
- Need multiple expert perspectives
