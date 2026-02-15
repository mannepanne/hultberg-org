// ABOUT: Utility functions for the blog feature
// ABOUT: Includes slug generation and other helper functions

/**
 * Generates a URL-safe slug from a title
 * @param title - The update title
 * @param existingSlugs - Array of existing slugs to check for duplicates
 * @returns A unique, URL-safe slug
 */
export function generateSlug(title: string, existingSlugs: string[]): string {
  // Convert to lowercase, replace spaces with hyphens
  let slug = title.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  // Handle reserved slugs
  if (slug === 'page') {
    slug = 'page-2';
  }

  // Check for duplicates
  let finalSlug = slug;
  let counter = 2;
  while (existingSlugs.includes(finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
}
