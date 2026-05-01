# Implementation Specifications Library

Auto-loaded when working with files in this directory. Forward-looking plans for features being built.

---

## How specifications work in this project

This directory holds **one-off feature specs**, not numbered sequential phases. Each spec describes a single feature — its scope, technical approach, and acceptance criteria — and is moved to [`ARCHIVE/`](./ARCHIVE/) once the feature ships.

**Workflow:**
1. Create a new `.md` file in this directory describing the feature you're about to build.
2. Implement the feature on a feature branch, with tests.
3. After the implementing PR merges, move the spec to [`ARCHIVE/`](./ARCHIVE/) following the [archive link convention](./ARCHIVE/CLAUDE.md#link-convention-for-archived-specs) (add an extra `../` to outbound relative links).
4. If the feature has ongoing operational details, capture them in [`REFERENCE/`](../REFERENCE/) as how-it-works documentation.

## What a spec should cover

The exact shape varies by feature, but a useful spec usually includes:

- **Scope** — what's in, what's explicitly out
- **Technical approach** — architecture, key files, database/storage changes if any
- **Testing strategy** — unit, integration, manual checks
- **Acceptance criteria** — how you know the feature is done
- **Open questions** — anything you want to decide during implementation rather than upfront

Significant architectural choices made while implementing a spec should land as ADRs in [`REFERENCE/decisions/`](../REFERENCE/decisions/) — see [ADR guidance](../REFERENCE/decisions/CLAUDE.md) for when and how.

[`00-TEMPLATE-phase.md`](./00-TEMPLATE-phase.md) is a fuller template if you want a more structured starting point — useful for larger features, overkill for small ones.

## Current state

No active specs at the moment. All completed feature specs are in [`ARCHIVE/`](./ARCHIVE/).

## Supporting locations

- [`ARCHIVE/`](./ARCHIVE/) — completed specifications
- [`mockups/`](./mockups/) — UI/UX mockups, design references
- [`../REFERENCE/decisions/`](../REFERENCE/decisions/) — Architecture Decision Records (consult before making similar decisions)
