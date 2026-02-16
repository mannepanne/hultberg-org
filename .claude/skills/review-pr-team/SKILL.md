---
name: review-pr-team
description: Comprehensive PR review using multiple specialized reviewers (security, product, architecture). Use when you need thorough, multi-perspective analysis of a pull request.
disable-model-invocation: true
user-invocable: true
argument-hint:
  - PR-number
---
# Multi-Perspective PR Review

This skill provides comprehensive pull request review from three specialized perspectives:
1. **Security Reviewer** - Authentication, secrets, XSS, CSRF, input validation, SQL injection
2. **Product Manager** - Business value, market and customer fit, user experience, features, edge cases, requirements alignment
3. **Senior Architect** - Design patterns, scalability, maintainability, tech debt, suitability for autonomous LLM agents, 100% code coverage

## How This Works

Three independent reviews are conducted **sequentially**:
- Each reviewer analyzes the PR from their unique perspective
- Reviews are independent (no bias from seeing others' feedback)
- All findings are synthesized and posted to the PR
- Conflicts or overlaps between reviews are highlighted

---

## Instructions for Claude

When this skill is invoked with a PR number (e.g., `/review-pr-team 1`):

### Step 1: Fetch PR Context

Use GitHub CLI to gather PR information:

```bash
gh pr view $ARGUMENTS
gh pr diff $ARGUMENTS
gh pr view $ARGUMENTS --comments
```

Review the files changed, commit messages, and any existing comments.

---

### Step 2: Intelligently Gather Relevant Context

Use this systematic approach to gather just enough context for a thorough review:

**A. Always Read Foundation (MANDATORY):**

1. Read `CLAUDE.md` in repository root for:
   - Project architecture and structure
   - Development workflow and conventions
   - Key patterns and technology stack
   - Testing philosophy

**B. Extract PR Keywords:**

From PR title, description, and changed file paths, extract relevant keywords:
- Feature names (blog, auth, admin, api, etc.)
- Component types (routes, utils, components, etc.)
- Phase numbers (phase-1, phase-2, etc.)
- Technical areas (security, testing, deployment, etc.)

Examples:
- PR title "Phase 2: Public pages" → keywords: "public", "pages", "phase", "2"
- Changed files include `src/routes/updatesList.ts` → keywords: "updates", "routes", "list"
- PR mentions "authentication" → keywords: "auth", "login", "security"

**C. Discover Relevant Specifications:**

1. List files in `SPECIFICATIONS/` directory using Bash or Glob
2. Match spec filenames against PR keywords
3. Read specifications that match, prioritizing:
   - Files matching feature names (e.g., `*blog*.md` if PR involves blog)
   - `*-implementation.md` if PR implements a feature
   - `*-security.md` if security-related changes detected
   - `testing-*.md` if tests are included or test files changed
   - `*-mvp.md` or `*-plan.md` for main feature specs

**D. Follow Relevant Links (Selective):**

- In each spec read, check "Related Documents" sections
- Follow links to specs that match PR keywords
- Don't read every linked doc - be selective based on relevance
- Example: If spec links to testing strategy and PR includes tests, read it

**E. Create Context Summary:**

Synthesize gathered information into a structured summary including:
- Project architecture and conventions (from CLAUDE.md)
- What this PR should achieve (from specs and PR description)
- Key requirements and success criteria
- Security requirements (if applicable)
- Testing expectations (if applicable)
- Architectural decisions made

This context will be provided to each reviewer so they can evaluate whether the PR matches the project architecture and intended design.

**If no specifications found:** Note this and reviewers will evaluate based on project architecture (from CLAUDE.md) and general best practices.

**Note:** This approach is future-proof - it discovers relevant context for any PR without hard-coding specific files.

---

### Step 3: Security Review (Subagent 1)

Spawn a **general-purpose** subagent with this task:

**Task:** "Act as a security specialist reviewing PR #$ARGUMENTS for security issues.

**Project Context:**
[Paste the context summary from Step 2, including project architecture from CLAUDE.md and security requirements if specified]

Focus on:

**Authentication & Authorization:**
- Are credentials/secrets properly protected?
- Are authentication flows secure?
- Is authorization checked on all protected endpoints?

**Input Validation:**
- Is user input validated and sanitized?
- Are there SQL injection, XSS, or command injection risks?
- Are file uploads validated (type, size)?

**Data Protection:**
- Are secrets stored securely (not in code)?
- Is sensitive data encrypted/hashed appropriately?
- Are API keys and tokens handled correctly?

**CSRF & Session Management:**
- Is CSRF protection implemented?
- Are cookies configured securely (HttpOnly, Secure, SameSite)?
- Is session management robust?

**Dependencies:**
- Are new dependencies from trusted sources?
- Any known vulnerabilities in added packages?

**Output Format:**
- ✅ **Secure Practices**: What's done well
- 🔴 **Critical Issues**: Must fix before merge
- ⚠️ **Warnings**: Should fix, not blocking
- 💡 **Suggestions**: Nice-to-haves

Be specific with file:line references."

Wait for the security review to complete.

---

### Step 4: Product Manager Review (Subagent 2)

Spawn a **general-purpose** subagent with this task:

**Task:** "Act as a product manager reviewing PR #$ARGUMENTS for product quality and user experience.

**Project Context:**
[Paste the context summary from Step 2, including project architecture from CLAUDE.md, feature requirements, and success criteria]

Focus on:

**Requirements Alignment:**
- Does this PR match the stated goals/requirements?
- Are all acceptance criteria met?
- Is anything out of scope or missing?

**User Experience:**
- Is the feature intuitive and user-friendly?
- Are error messages clear and helpful?
- Is the UI/UX consistent with existing patterns?

**Edge Cases:**
- Are edge cases handled (empty states, errors, etc.)?
- What happens when things go wrong?
- Are loading states and feedback clear?

**Completeness:**
- Is the feature fully functional?
- Are there half-finished parts?
- Is documentation updated (if needed)?

**Future Impact:**
- Does this create technical debt?
- Will this be easy to extend later?
- Any backward compatibility issues?

**Output Format:**
- ✅ **Well Done**: What meets/exceeds expectations
- 🔴 **Blocking Issues**: Must address before ship
- ⚠️ **Concerns**: Should address, worth discussing
- 💡 **Enhancements**: Ideas for improvement

Be specific with examples and file references."

Wait for the product review to complete.

---

### Step 5: Senior Architect Review (Subagent 3)

Spawn a **general-purpose** subagent with this task:

**Task:** "Act as a senior software architect reviewing PR #$ARGUMENTS for design quality and long-term maintainability.

**Project Context:**
[Paste the context summary from Step 2, including project architecture from CLAUDE.md, architectural decisions, and implementation approach]

Focus on:

**Architecture & Design:**
- Does this fit well with existing architecture?
- Are design patterns used appropriately?
- Is the code organization logical?

**Code Quality:**
- Is the code readable and well-structured?
- Are functions/components properly sized?
- Are naming conventions clear and consistent?

**Scalability & Performance:**
- Will this perform well under load?
- Are there potential bottlenecks?
- Is caching/optimization appropriate?

**Maintainability:**
- Is the code easy to understand and modify?
- Are abstractions appropriate (not over/under-engineered)?
- Are there code smells or anti-patterns?

**Testing:**
- Is test coverage adequate?
- Are the right things being tested?
- Are tests maintainable?

**Technical Debt:**
- Does this introduce debt?
- Does it pay down existing debt?
- Are shortcuts documented and justified?

**Output Format:**
- ✅ **Architectural Strengths**: Good design decisions
- 🔴 **Critical Issues**: Fundamental problems to fix
- ⚠️ **Design Concerns**: Worth reconsidering
- 💡 **Suggestions**: Ways to improve design

Be specific with code examples and file:line references."

Wait for the architecture review to complete.

---

### Step 6: Synthesize and Post Results

After all three reviews are complete:

1. **Analyze findings across all reviews:**
  - Identify overlapping concerns (mentioned by multiple reviewers)
  - Flag conflicts (if reviewers disagree)
  - Highlight critical issues that appear in multiple perspectives

2. **Create unified summary:**

```markdown
## Comprehensive PR Review - Multiple Perspectives

### 🔴 Critical Issues (Must Fix Before Merge)

[List all critical issues from all reviewers, grouped by theme]
[Mark with [Security], [Product], or [Architecture] badges]
[Note if multiple reviewers flagged the same issue]

### ⚠️ Warnings & Concerns (Should Address)

[List warnings from all reviewers, grouped by theme]

### ✅ Strengths & Good Practices

[Highlight what all reviewers praised]

### 💡 Suggestions for Improvement

[Compile suggestions, note if multiple reviewers suggested similar improvements]

### 📊 Review Summary

- **Security Review**: [X critical, Y warnings, Z suggestions]
- **Product Review**: [X critical, Y warnings, Z suggestions]
- **Architecture Review**: [X critical, Y warnings, Z suggestions]

---

**Recommendation:** [Clear merge/don't merge recommendation based on critical issues]

---

*Reviews conducted by specialized subagents: Security Specialist, Product Manager, Senior Architect*
```

3. **Post the synthesized review** as a comment on the PR using:

```bash
gh pr comment $ARGUMENTS --body "[markdown content from above]"
```

4. **Provide user summary:**
  - Total critical issues found
  - Key themes across reviews
  - Clear next steps
  - Link to PR comment

---

## Example Usage

```
/review-pr-team 1
```

This will:
1. Fetch PR #1 details
2. Run security review (sequential)
3. Run product review (sequential)
4. Run architecture review (sequential)
5. Synthesize all findings
6. Post comprehensive review to PR #1

---

## Tips for Best Results

- **Use on non-trivial PRs** - Overkill for typo fixes
- **Run before final approval** - Catch issues early
- **Read individual reviews** - Each perspective provides unique value
- **Address critical issues first** - Don't merge with red flags

---

<!-- NOTE: This is NOT part of the skill instructions -->

## Future Enhancement: Parallel Execution (Option A)

**Current implementation:** Reviews run sequentially (one after another)
- Security → Product → Architecture
- Total time: ~3-5 minutes depending on PR size

**Future upgrade:** Agent Teams for parallel execution
- All three reviewers analyze simultaneously
- Total time: ~1-2 minutes (faster)
- Requires: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings

**When agent teams feature is stable**, this skill can be upgraded to spawn parallel reviewers instead of sequential ones. The skill structure and review criteria would remain the same—only the execution model changes.

**To upgrade later:**
1. Enable experimental flag in `.claude/settings.json`
2. Modify Step 2-4 to spawn teammates instead of sequential subagents
3. Teammates review in parallel
4. Main agent still synthesizes results

The sequential approach works perfectly fine for now and proves the concept.
