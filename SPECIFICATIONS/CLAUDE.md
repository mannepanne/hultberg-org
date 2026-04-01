# Implementation Specifications Library

Auto-loaded when working with files in this directory. Forward-looking plans for features being built.

---

**⚠️ TEMPLATE GUIDANCE** - This file explains how to use this folder. When starting a new project, update this file to list your actual implementation phases.

---

## Purpose of this folder

The SPECIFICATIONS folder contains **forward-looking plans** for features you're actively building. These are living documents that guide development and evolve as you learn more.

### Key Principles

1. **Specifications are active work** - They describe what you're building *now* or *next*
2. **One phase at a time** - Focus on clear, sequential implementation phases
3. **Move completed specs to ARCHIVE/** - Keep this folder focused on current/upcoming work
4. **Reference ORIGINAL_IDEA/** - Link back to master vision for context

## How to structure implementation phases

Break your project into numbered sequential phases (e.g., 01-foundation.md, 02-authentication.md, etc.).

### What each phase file should include

1. **Phase Overview**
   - Phase number and name
   - Brief description
   - Estimated timeframe
   - Dependencies on previous phases

2. **Scope and Deliverables**
   - What will be built in this phase
   - What's explicitly out of scope
   - Acceptance criteria

3. **Technical Approach**
   - Architecture decisions (document significant choices as ADRs in REFERENCE/decisions/)
   - Technology choices (check existing ADRs for precedent before deciding)
   - Key files and components
   - Database schema changes (if applicable)

4. **Testing Strategy**
   - Unit test requirements
   - Integration test requirements
   - Coverage targets
   - Manual testing checklist

5. **Pre-Commit Checklist**
   - [ ] All tests passing
   - [ ] Type checking passes
   - [ ] Coverage meets targets
   - [ ] Manual verification complete
   - [ ] Documentation updated

6. **PR Workflow**
   - Branch naming convention
   - PR review requirements
   - Deployment steps

7. **Edge Cases and Considerations**
   - Known risks or challenges
   - Alternative approaches considered
   - Future optimization opportunities

### Example Phase Structure

See [00-TEMPLATE-phase.md](./00-TEMPLATE-phase.md) for a complete example.

## Supporting folders

### ORIGINAL_IDEA/

Store your initial project concept documents here:
- Master specification and product vision
- Naming rationale and inspiration
- Early brainstorming and requirements
- Competitive analysis or market research

These documents are the "source of truth" for the project's intent and typically don't change during implementation.

### ARCHIVE/

Move completed phase files here after:
1. Phase implementation is complete
2. PR is merged to main
3. Features are deployed/verified

Archive serves as historical record. For current implementation details, see `REFERENCE/` documentation instead.

## Workflow example

**Starting a new project:**
1. Create master specification in `ORIGINAL_IDEA/project-outline.md`
2. Break project into phases (e.g., 01-foundation.md, 02-core-features.md)
3. Work through phases sequentially
4. Move completed specs to ARCHIVE/
5. Create how-it-works docs in REFERENCE/ for implemented features

**Current phase tracking:**
Update the "Current phase" indicator in both:
- Root CLAUDE.md (project navigation)
- This file (implementation library)

## When to update this file

Replace this template guidance with your actual phase list when you:
1. Complete project planning
2. Define your implementation phases
3. Are ready to begin development

**Keep it current** - Update phase status as you progress through development.

---

## Template replacement

When starting your project, replace the content below this line with your actual implementation phase list.

---

## Active implementation phases

Development is organised into [X] sequential phases. Each phase includes scope, acceptance criteria, testing strategy, and PR workflow.

**Current phase:** [Phase number and name]

### Phase Files (Work Through in Order)

1. **[01-phase-name.md](./01-phase-name.md)** - [Timeframe]
   [Brief description of what this phase builds]

2. **[02-phase-name.md](./02-phase-name.md)** - [Timeframe]
   [Brief description of what this phase builds]

3. **[03-phase-name.md](./03-phase-name.md)** - [Timeframe]
   [Brief description of what this phase builds]

[Continue numbering phases...]

### Supporting documentation

**[ORIGINAL_IDEA/](./ORIGINAL_IDEA/)**
- `project-outline.md` - Master specification and product vision
- `naming-rationale.md` - Project naming inspiration
- [Add other initial concept documents]

**[ARCHIVE/](./ARCHIVE/)**
- Completed specifications (moved here when phase is done)

**[REFERENCE/decisions/](../REFERENCE/decisions/)** - Architecture Decision Records
- Search here BEFORE making architectural decisions (library choice, patterns, API design)
- Follow existing ADRs unless new information invalidates reasoning
- Document new architectural decisions here (prevents re-debating settled choices)
- See [ADR guidance](../REFERENCE/decisions/CLAUDE.md) for when and how to create ADRs

## When specs move to archive

After completing a phase and merging the PR:
1. Move the phase file to `ARCHIVE/`
2. Update implementation docs in `REFERENCE/` if needed
3. Update this index to reflect current phase
