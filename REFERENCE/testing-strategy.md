# Testing Strategy Plan

**Related Documents:**
- [blog-style-updates-mvp.md](./blog-style-updates-mvp.md)
- [blog-updates-implementation.md](./blog-updates-implementation.md)
- [CLAUDE.md](../CLAUDE.md)

---

## Philosophy: Tests as Development Guardrails

**Inspired by:** [OpenAI's Harness Engineering](https://openai.com/index/harness-engineering/) approach to agent-driven development.

Tests in this project serve dual purposes:

1. **Validation** - Verify code works correctly (traditional testing)
2. **Directional Context** - Guide agents on what to build and how to build it

When an AI agent makes changes, tests should:
- Immediately signal if changes break existing functionality
- Provide clear context about what each component should do
- Act as executable specifications that agents can read and understand
- Make it obvious when a change is going in the wrong direction

---

## Testing Principles

### 1. Tests Define Expected Behavior

Tests are **living specifications**. Before writing implementation code, write tests that describe:
- What should happen in the happy path
- What should happen when things go wrong
- What constraints and validations must be enforced

### 2. 100% Code Coverage Goal

Every line of code should be covered by at least one test because:
- Agents need clear examples of how code should behave
- Untested code is unclear about its purpose and constraints
- Coverage gaps indicate missing specifications

### 3. Tests Fail Fast with Clear Messages

When tests fail, the error message should:
- Explain **what** was expected
- Show **what** actually happened
- Indicate **where** to look (file:line references)
- Suggest **why** it might have failed

### 4. Test Organization Mirrors Code Structure

```
src/
  utils/slugGeneration.ts
  routes/updatesList.ts

tests/
  utils/slugGeneration.test.ts
  routes/updatesList.test.ts
```

Agents can quickly find relevant tests when modifying code.

### 5. Tests Are Self-Contained

Each test should:
- Set up its own fixtures and data
- Clean up after itself
- Not depend on other tests running first
- Be runnable in isolation

---

## Testing Framework

### Technology Stack

**Test Runner:** [Vitest](https://vitest.dev/)
- Fast, modern, built for TypeScript
- Great DX with watch mode and coverage
- Works well with Cloudflare Workers (unlike Jest)
- Supports ES modules natively

**Assertion Library:** Vitest's built-in assertions (compatible with Chai/Jest)

**Mocking:** Vitest's built-in mocking + custom Worker environment mocks

**Coverage:** Vitest with v8 coverage provider

### Setup Requirements

```bash
npm install -D vitest @vitest/coverage-v8
```

**Configuration:** `vitest.config.ts` in project root

---

## Test Categories

### 1. Unit Tests

**Purpose:** Test individual functions and utilities in isolation

**Scope:**
- Slug generation (`src/utils/slugGeneration.ts`)
- Date formatting utilities
- Markdown parsing and sanitization
- Input validation functions
- Excerpt generation logic

**Example Structure:**
```typescript
// tests/utils/slugGeneration.test.ts
import { describe, it, expect } from 'vitest';
import { generateSlug, isSlugUnique } from '@/utils/slugGeneration';

describe('generateSlug', () => {
  it('converts title to lowercase with hyphens', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('removes special characters except hyphens', () => {
    expect(generateSlug('Hello, World!')).toBe('hello-world');
  });

  it('handles consecutive spaces', () => {
    expect(generateSlug('Hello    World')).toBe('hello-world');
  });

  it('prevents reserved slug "page"', () => {
    expect(generateSlug('Page')).toBe('page-2');
  });
});
```

### 2. Integration Tests

**Purpose:** Test how components work together

**Scope:**
- Worker route handlers with mocked KV and env
- Admin API endpoints with mocked GitHub API
- Authentication flow with mocked Resend API
- File operations with mocked fetch responses

**Example Structure:**
```typescript
// tests/routes/adminApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '@/index';

describe('POST /admin/api/save-update', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      GITHUB_TOKEN: 'test-token',
      AUTH_KV: createMockKV(),
      // ... other env vars
    };
  });

  it('rejects unauthenticated requests', async () => {
    const request = new Request('http://localhost/admin/api/save-update', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' }),
    });

    const response = await worker.fetch(request, mockEnv, {});
    expect(response.status).toBe(401);
  });

  it('validates required fields', async () => {
    const request = createAuthenticatedRequest('/admin/api/save-update', {
      method: 'POST',
      body: JSON.stringify({ title: '' }), // Missing title
    });

    const response = await worker.fetch(request, mockEnv, {});
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('title');
  });
});
```

### 3. End-to-End Tests

**Purpose:** Test complete user workflows

**Scope:**
- Public user can view published updates
- Admin can log in via magic link
- Admin can create, edit, and delete updates
- Images upload and display correctly
- RSS feed generates properly

**Example Structure:**
```typescript
// tests/e2e/publicWorkflow.test.ts
import { describe, it, expect } from 'vitest';
import worker from '@/index';

describe('Public User Workflow', () => {
  it('can view updates listing page', async () => {
    const request = new Request('http://localhost/updates');
    const response = await worker.fetch(request, mockEnv, {});

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Updates');
  });

  it('cannot view draft updates', async () => {
    const request = new Request('http://localhost/updates/draft-update');
    const response = await worker.fetch(request, mockEnv, {});

    expect(response.status).toBe(404);
  });

  it('can view published updates', async () => {
    const request = new Request('http://localhost/updates/published-update');
    const response = await worker.fetch(request, mockEnv, {});

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<h1>Published Update</h1>');
  });
});
```

---

## Test-Driven Development Workflow

### For New Features

1. **Write failing tests first** - Define expected behavior
2. **Implement minimum code** - Make tests pass
3. **Refactor** - Improve code while keeping tests green
4. **Verify coverage** - Ensure 100% of new code is tested

### For Bug Fixes

1. **Write failing test** - Reproduce the bug
2. **Fix the bug** - Make test pass
3. **Add edge case tests** - Prevent regression

### For Refactoring

1. **Verify existing tests pass** - Baseline
2. **Refactor code** - Change implementation
3. **Tests still pass** - Behavior unchanged
4. **Coverage maintained** - No gaps introduced

---

## Mocking Strategy

### What to Mock

**External Services:**
- GitHub API (file commits, repo operations)
- Resend API (email sending)
- Cloudflare KV (in-memory mock for tests)

**Static Assets:**
- File system reads (`public/updates/data/*.json`)
- Image files

### What NOT to Mock

**Core Logic:**
- Slug generation
- Markdown parsing
- Input validation
- Date formatting

**Reason:** These are the primary value of our code - mocking them defeats the purpose of testing.

### Mock Implementations

Create reusable mocks in `tests/mocks/`:

```typescript
// tests/mocks/kvNamespace.ts
export function createMockKV(): KVNamespace {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async () => ({ keys: Array.from(store.keys()).map(name => ({ name })) }),
  };
}

// tests/mocks/github.ts
export function createMockGitHub() {
  const commits: any[] = [];

  return {
    commitFile: vi.fn(async (path, content) => {
      commits.push({ path, content });
      return { sha: 'mock-sha' };
    }),
    getCommits: () => commits,
  };
}
```

---

## Coverage Requirements

### Overall Coverage Target: 100%

**Why 100%?**
- Every line of code should have a clear purpose
- If we can't test it, maybe we don't need it
- Agents need complete context about all code paths

### Per-File Coverage Requirements

| File Type | Statements | Branches | Functions | Lines |
|-----------|-----------|----------|-----------|-------|
| Utils | 100% | 100% | 100% | 100% |
| Routes | 95%+ | 90%+ | 100% | 95%+ |
| Types | N/A | N/A | N/A | N/A |
| Config | N/A | N/A | N/A | N/A |

**Allowed Exceptions:**
- Type definition files (no executable code)
- Configuration files (vitest.config.ts, tsconfig.json)
- Explicitly marked `/* istanbul ignore */` blocks (must have comment explaining why)

### Coverage Reporting

```bash
npm run test:coverage
```

**Output:**
- Terminal summary (immediate feedback)
- HTML report in `coverage/index.html` (detailed drill-down)
- Coverage badges in README (visibility)

---

## CI/CD Integration

### Pre-Commit Hooks

Run tests locally before commit:
```bash
npm run test:changed  # Only test files related to staged changes
```

### Pull Request Checks

GitHub Actions must pass:
1. **All tests pass** - No failures allowed
2. **Coverage maintained** - No decrease from main branch
3. **TypeScript compiles** - No type errors
4. **Linting passes** - Code style consistent

### Deployment Gate

**Production deployment blocked if:**
- Any test fails
- Coverage below 95% overall
- Critical paths not tested

---

## Test Documentation Standards

### Test Naming

Use clear, descriptive test names that read like specifications:

**Good:**
```typescript
it('generates unique slug by appending -2 when duplicate exists')
it('returns 404 when requesting draft update as public user')
it('sanitizes HTML in markdown content to prevent XSS')
```

**Bad:**
```typescript
it('works')
it('test slug')
it('returns error')
```

### Test Organization

Group related tests with `describe` blocks:

```typescript
describe('Slug Generation', () => {
  describe('generateSlug()', () => {
    it('converts to lowercase');
    it('replaces spaces with hyphens');
    it('removes special characters');
  });

  describe('isSlugUnique()', () => {
    it('returns true when slug not in use');
    it('returns false when slug exists');
  });
});
```

### Comments in Tests

Add comments for:
- Complex test setup
- Non-obvious assertions
- Edge cases being tested

**Example:**
```typescript
it('prevents token reuse within 5 seconds', async () => {
  // KV has eventual consistency - tokens may appear valid
  // in different regions for up to 60 seconds after deletion.
  // We prevent reuse by checking timestamp.

  const token = 'test-token';
  await useToken(token); // First use

  // Attempt immediate reuse
  const result = await useToken(token);
  expect(result.error).toBe('Token already used');
});
```

---

## Testing by Phase

### Phase 1: Storage & Data Structure ✅

**Already completed:**
- TypeScript types defined
- Directory structure created

**Phase 1.5 Testing Setup:**
- Install Vitest and coverage tools
- Create basic test structure
- Write tests for type validation
- Set up CI/CD test runner

### Phase 2: Public Pages

**Test Requirements:**
- Route handler for `/updates` returns 200
- Pagination works correctly
- Individual update pages render markdown
- Drafts return 404 to public
- RSS feed generates valid XML

### Phase 3: Authentication

**Test Requirements:**
- Magic link generation creates valid tokens
- Tokens expire after 15 minutes
- Token reuse within 5 seconds blocked
- Invalid tokens rejected
- Cookie authentication validates correctly
- Rate limiting enforces 10 req/min

### Phase 4: Admin Dashboard

**Test Requirements:**
- Dashboard shows all updates (including drafts)
- Deploy status polling returns correct state
- Update filtering works (published/draft)
- UI renders without errors

### Phase 5: Update Editor

**Test Requirements:**
- EasyMDE initializes correctly
- Image upload resizes to 800x800
- Markdown preview renders properly
- Form validation catches empty title
- Slug generation handles duplicates

### Phase 6: Worker Backend API

**Test Requirements:**
- Save endpoint commits to GitHub
- Delete endpoint removes update and images
- Image upload endpoint handles file types
- All endpoints validate authentication
- Input validation catches malformed data

### Phase 7: Auto-Deployment

**Test Requirements:**
- Index generation includes only published updates
- Excerpt generation uses first 150 chars
- GitHub Action workflow syntax valid
- Deployment triggers on correct file changes

### Phase 8: Testing & Polish

**Test Requirements:**
- Achieve 100% coverage
- All edge cases covered
- Performance benchmarks met
- Security tests pass (XSS, injection, etc.)

### Phase 9: Documentation

**Test Requirements:**
- All public APIs documented
- Code examples in docs are tested
- README instructions work end-to-end

---

## Measuring Success

### Quantitative Metrics

- **Coverage:** 100% of lines, 95%+ of branches
- **Test Speed:** Full suite runs in < 10 seconds
- **PR Velocity:** Tests catch issues before manual review
- **Bug Escape Rate:** Zero bugs reach production that tests should have caught

### Qualitative Metrics

- **Agent Confidence:** Can AI make changes safely with test guidance?
- **Developer Clarity:** Do tests clearly show what code should do?
- **Maintenance Burden:** Are tests easy to update when requirements change?

---

## When Tests Are Not Enough

Tests validate **correctness**, but don't guarantee:
- Good UX (need manual testing)
- Performance at scale (need load testing)
- Security against novel attacks (need security review)

**Complement tests with:**
- Manual testing on real devices/browsers
- Security reviews for auth and data handling
- Performance profiling for large datasets

---

## Future Enhancements (Post-MVP)

- **Property-based testing** - Generate random inputs to find edge cases
- **Mutation testing** - Verify tests actually catch bugs
- **Visual regression testing** - Catch UI changes
- **Load testing** - Validate performance under stress
- **Accessibility testing** - WCAG compliance

---

**Status:** Phase 1.5 specification complete, ready for implementation
**Next:** Implement testing infrastructure before continuing with Phase 2

