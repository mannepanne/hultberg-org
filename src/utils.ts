// ABOUT: Shared utility functions used across the application
// ABOUT: Provides common helpers like HTML escaping, slug generation, and base64 encoding

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a URL-safe slug from a title.
 * If the slug already exists in existingSlugs, appends a numeric suffix.
 * Examples: "My Post" → "my-post", "My Post" (exists) → "my-post-2"
 */
export function generateSlugFromTitle(title: string, existingSlugs: string[]): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
    .replace(/-$/, '') || 'update';

  if (!existingSlugs.includes(base)) return base;

  let counter = 2;
  while (existingSlugs.includes(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

/**
 * Encode a string to Base64, handling Unicode characters correctly.
 * btoa() alone only handles Latin-1, so we encode to UTF-8 bytes first.
 * Required for GitHub API content uploads (Markdown with Swedish characters etc.)
 */
export function encodeBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
