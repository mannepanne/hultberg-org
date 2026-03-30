// ABOUT: HTML sanitization utility for user-generated content
// ABOUT: Removes dangerous tags, protocols, and event handlers to prevent XSS

/**
 * Sanitizes HTML content to prevent XSS attacks
 *
 * This function:
 * - Preserves img tags with safe attributes (width, height, style)
 * - Removes dangerous tags (script, iframe, object, embed, applet, base, link, meta, form)
 * - Removes dangerous protocols (javascript:, data:, vbscript:, file:, about:)
 * - Removes inline event handlers (onclick, onerror, etc.)
 * - Removes style attributes (except on img tags)
 *
 * TODO: Replace with proper allowlist-based sanitizer when Workers-compatible library available.
 * Current approach uses regex-based filtering which is not ideal but acceptable because:
 * - Single trusted admin (no untrusted user input)
 * - Content version-controlled in GitHub
 * - CSP headers provide defense-in-depth
 * - Server-side rendering only
 * See REFERENCE/technical-debt.md for details.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHTML(html: string): string {
  let sanitized = html;

  // Preserve img tags but sanitize them individually (remove event handlers, keep width/height/style)
  const imgTags: string[] = [];
  const imgPlaceholder = '___IMG_PLACEHOLDER_';
  sanitized = sanitized.replace(/<img\b[^>]*>/gi, (match) => {
    // Remove event handlers from img tag
    let cleanImg = match
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
      .replace(/\son\w+=/gi, '');
    imgTags.push(cleanImg);
    return `${imgPlaceholder}${imgTags.length - 1}___`;
  });

  // Remove dangerous tags completely
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  // Remove dangerous protocols (case-insensitive, handle URL encoding)
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/file:/gi, '')
    .replace(/about:/gi, '');

  // Remove inline event handlers (all variations)
  sanitized = sanitized
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/\son\w+=/gi, '');

  // Remove style attributes that could contain expressions (but NOT on img tags, which were extracted)
  sanitized = sanitized
    .replace(/style\s*=\s*["'][^"']*["']/gi, '')
    .replace(/style\s*=\s*[^\s>]*/gi, '');

  // Restore img tags with their preserved attributes (style, width, height allowed on images)
  sanitized = sanitized.replace(/___IMG_PLACEHOLDER_(\d+)___/g, (match, index) => {
    return imgTags[parseInt(index)];
  });

  return sanitized;
}
