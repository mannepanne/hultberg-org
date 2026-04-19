// ABOUT: Unit tests for the pre-publish lint rules.

import { describe, it, expect } from 'vitest';
import { lintUpdate } from '@/lint';
import type { Update } from '@/types';

type Existing = Pick<Update, 'title' | 'status' | 'slug'>;

function makeUpdate(overrides: Partial<Pick<Update, 'title' | 'excerpt' | 'content' | 'images'>> = {}) {
  return {
    title: 'A fine update',
    excerpt: 'An appropriately long excerpt for social previews.',
    content: 'x'.repeat(400),
    images: [] as string[],
    ...overrides,
  };
}

describe('lintUpdate — clean input', () => {
  it('returns no warnings when everything looks good', () => {
    const warnings = lintUpdate({
      update: makeUpdate({ images: ['/images/updates/foo.jpg'] }),
      existingUpdates: [],
    });
    expect(warnings).toEqual([]);
  });
});

describe('lintUpdate — missing-excerpt', () => {
  it('warns when excerpt is empty', () => {
    const warnings = lintUpdate({
      update: makeUpdate({ excerpt: '', images: ['/img/a.jpg'] }),
      existingUpdates: [],
    });
    expect(warnings.map((w) => w.rule)).toContain('missing-excerpt');
  });

  it('treats whitespace-only excerpt as empty', () => {
    const warnings = lintUpdate({
      update: makeUpdate({ excerpt: '   \n\t ', images: ['/img/a.jpg'] }),
      existingUpdates: [],
    });
    expect(warnings.map((w) => w.rule)).toContain('missing-excerpt');
  });
});

describe('lintUpdate — thin-content', () => {
  it('warns when content is shorter than 300 chars', () => {
    const warnings = lintUpdate({
      update: makeUpdate({ content: 'short' }),
      existingUpdates: [],
    });
    expect(warnings.map((w) => w.rule)).toContain('thin-content');
    expect(warnings.find((w) => w.rule === 'thin-content')?.message).toContain('5 characters');
  });

  it('does not warn at exactly 300 chars', () => {
    const warnings = lintUpdate({
      update: makeUpdate({ content: 'x'.repeat(300) }),
      existingUpdates: [],
    });
    expect(warnings.map((w) => w.rule)).not.toContain('thin-content');
  });
});

describe('lintUpdate — duplicate-title', () => {
  it('warns when a published update has the same title', () => {
    const existing: Existing[] = [
      { title: 'A fine update', status: 'published', slug: 'a-fine-update' },
    ];
    const warnings = lintUpdate({
      update: makeUpdate({ title: 'A fine update' }),
      existingUpdates: existing,
    });
    const dupe = warnings.find((w) => w.rule === 'duplicate-title');
    expect(dupe).toBeTruthy();
    expect(dupe?.message).toContain('a-fine-update');
  });

  it('is case-insensitive', () => {
    const existing: Existing[] = [
      { title: 'A Fine Update', status: 'published', slug: 'a-fine-update' },
    ];
    const warnings = lintUpdate({
      update: makeUpdate({ title: 'a fine update' }),
      existingUpdates: existing,
    });
    expect(warnings.map((w) => w.rule)).toContain('duplicate-title');
  });

  it('ignores updates with non-published status', () => {
    const existing: Existing[] = [
      { title: 'A fine update', status: 'draft', slug: 'a-fine-update' },
      { title: 'A fine update', status: 'unpublished', slug: 'b-fine-update' },
    ];
    const warnings = lintUpdate({
      update: makeUpdate({ title: 'A fine update' }),
      existingUpdates: existing,
    });
    expect(warnings.map((w) => w.rule)).not.toContain('duplicate-title');
  });

  it('excludes the current update itself when editing', () => {
    const existing: Existing[] = [
      { title: 'A fine update', status: 'published', slug: 'a-fine-update' },
    ];
    const warnings = lintUpdate({
      update: makeUpdate({ title: 'A fine update' }),
      existingUpdates: existing,
      currentSlug: 'a-fine-update',
    });
    expect(warnings.map((w) => w.rule)).not.toContain('duplicate-title');
  });
});

describe('lintUpdate — poor-social-preview', () => {
  it('warns when no excerpt AND no images', () => {
    const warnings = lintUpdate({
      update: makeUpdate({ excerpt: '', images: [] }),
      existingUpdates: [],
    });
    expect(warnings.map((w) => w.rule)).toContain('poor-social-preview');
  });

  it('does not warn when an image is present even with empty excerpt', () => {
    const warnings = lintUpdate({
      update: makeUpdate({ excerpt: '', images: ['/img/a.jpg'] }),
      existingUpdates: [],
    });
    expect(warnings.map((w) => w.rule)).not.toContain('poor-social-preview');
  });

  it('does not warn when excerpt is present even with no images', () => {
    const warnings = lintUpdate({
      update: makeUpdate({ excerpt: 'a good excerpt', images: [] }),
      existingUpdates: [],
    });
    expect(warnings.map((w) => w.rule)).not.toContain('poor-social-preview');
  });
});

describe('lintUpdate — multiple rules', () => {
  it('returns all applicable warnings together', () => {
    const warnings = lintUpdate({
      update: makeUpdate({ excerpt: '', content: 'tiny', images: [] }),
      existingUpdates: [],
    });
    const rules = warnings.map((w) => w.rule);
    expect(rules).toContain('missing-excerpt');
    expect(rules).toContain('thin-content');
    expect(rules).toContain('poor-social-preview');
  });
});
