// ABOUT: Type definitions for Cloudflare Workers environment
// ABOUT: Ensures type safety for environment variables and KV namespaces

export interface Env {
  // Workers KV namespace for auth tokens and rate limiting
  MAGIC_LINK_TOKENS: KVNamespace;

  // External service API keys
  RESEND_API_KEY: string;
  GITHUB_TOKEN: string;

  // Configuration
  ADMIN_EMAIL: string;
  JWT_SECRET: string;
}

export interface Update {
  slug: string;
  title: string;
  excerpt: string;  // Empty string if not provided
  content: string;
  status: 'draft' | 'published' | 'unpublished';
  publishedDate: string;  // ISO 8601 format, empty string for drafts
  editedDate: string;     // ISO 8601 format
  author: string;
  images: string[];       // Array of image paths
}

export interface UpdateIndex {
  updates: {
    slug: string;
    title: string;
    excerpt: string;
    publishedDate: string;
    status: 'published';  // Index only contains published updates
  }[];
}
