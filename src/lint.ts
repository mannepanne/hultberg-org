// ABOUT: Pre-publish lint rules for updates. Pure functions only — no I/O.
// ABOUT: Warnings are non-blocking; the admin editor surfaces them so Magnus
// ABOUT: can see them but publish through them deliberately if he wants.

import type { Update } from './types';

export type LintRule =
  | 'missing-excerpt'
  | 'thin-content'
  | 'duplicate-title'
  | 'poor-social-preview';

export interface LintWarning {
  rule: LintRule;
  message: string;
}

const MIN_CONTENT_CHARS = 300;

export interface LintInput {
  update: Pick<Update, 'title' | 'excerpt' | 'content' | 'images'>;
  existingUpdates: Array<Pick<Update, 'title' | 'status' | 'slug'>>;
  currentSlug?: string; // exclude self from the duplicate-title check
}

/**
 * Compute lint warnings for an update being saved.
 * Intended to run only when status is transitioning to or staying at 'published'
 * — callers decide that; this function just applies the rules.
 */
export function lintUpdate(input: LintInput): LintWarning[] {
  const warnings: LintWarning[] = [];
  const { update } = input;

  const excerpt = update.excerpt.trim();
  const contentLength = update.content.trim().length;

  if (!excerpt) {
    warnings.push({
      rule: 'missing-excerpt',
      message: 'No excerpt — add one to improve SEO and social preview rendering.',
    });
  }

  if (contentLength < MIN_CONTENT_CHARS) {
    warnings.push({
      rule: 'thin-content',
      message: `Content is ${contentLength} characters — pages under ${MIN_CONTENT_CHARS} often don't get indexed.`,
    });
  }

  const titleLower = update.title.trim().toLowerCase();
  const duplicate = input.existingUpdates.find(
    (u) =>
      u.status === 'published' &&
      u.slug !== input.currentSlug &&
      u.title.trim().toLowerCase() === titleLower,
  );
  if (duplicate) {
    warnings.push({
      rule: 'duplicate-title',
      message: `Title matches an existing published update (${duplicate.slug}) — consider a unique title.`,
    });
  }

  if (update.images.length === 0 && !excerpt) {
    warnings.push({
      rule: 'poor-social-preview',
      message: 'No excerpt and no images — social shares will render without context.',
    });
  }

  return warnings;
}
