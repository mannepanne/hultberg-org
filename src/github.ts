// ABOUT: GitHub API utilities for reading and writing update files
// ABOUT: Wraps GitHub Contents API for listing, fetching, saving, and deleting updates and images

import type { Env } from './types';
import type { Update } from './types';
import { encodeBase64 } from './utils';

const GITHUB_REPO = 'mannepanne/hultberg-org';
const GITHUB_API_BASE = 'https://api.github.com';
const UPDATES_DATA_PATH = 'public/updates/data';
const IMAGES_PATH = 'public/images/updates';

function githubHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'hultberg-org-worker',
  };
}

interface GitHubFileEntry {
  name: string;
  type: string;
  download_url: string;
  url: string;
  sha: string;
}

/**
 * Fetch all updates from GitHub repository (drafts + published)
 * Returns an empty array if GITHUB_TOKEN is not configured or on error
 */
export async function fetchAllUpdates(env: Env): Promise<Update[]> {
  if (!env.GITHUB_TOKEN) {
    return [];
  }

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${UPDATES_DATA_PATH}`;
  const response = await fetch(url, {
    headers: githubHeaders(env.GITHUB_TOKEN),
  });

  if (!response.ok) {
    console.error(`GitHub API error listing updates: ${response.status}`);
    return [];
  }

  const files = await response.json() as GitHubFileEntry[];

  // Only JSON files, exclude the index
  const updateFiles = files.filter(
    f => f.type === 'file' && f.name.endsWith('.json') && f.name !== 'index.json'
  );

  // Fetch each update file in parallel via its raw download URL
  const results = await Promise.all(
    updateFiles.map(async (file) => {
      try {
        const fileResponse = await fetch(file.download_url);
        if (!fileResponse.ok) return null;
        return await fileResponse.json() as Update;
      } catch {
        return null;
      }
    })
  );

  const updates = results.filter((u): u is Update => u !== null);

  // Sort by editedDate descending (most recently edited first)
  return updates.sort((a, b) => {
    const dateA = a.editedDate ? new Date(a.editedDate).getTime() : 0;
    const dateB = b.editedDate ? new Date(b.editedDate).getTime() : 0;
    return dateB - dateA;
  });
}

/**
 * Delete an update JSON file from GitHub
 * Returns success/error result
 */
export async function deleteUpdateFile(
  env: Env,
  slug: string
): Promise<{ success: boolean; error?: string }> {
  if (!env.GITHUB_TOKEN) {
    return { success: false, error: 'GitHub token not configured' };
  }

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${UPDATES_DATA_PATH}/${slug}.json`;

  // GET the file first to retrieve its SHA (required for delete)
  const getResponse = await fetch(url, {
    headers: githubHeaders(env.GITHUB_TOKEN),
  });

  if (!getResponse.ok) {
    if (getResponse.status === 404) {
      return { success: false, error: 'Update not found' };
    }
    return { success: false, error: `GitHub API error: ${getResponse.status}` };
  }

  const fileData = await getResponse.json() as { sha: string };

  // DELETE the file using the retrieved SHA
  const deleteResponse = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...githubHeaders(env.GITHUB_TOKEN),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Delete update: ${slug}`,
      sha: fileData.sha,
    }),
  });

  if (!deleteResponse.ok) {
    return { success: false, error: `Failed to delete: ${deleteResponse.status}` };
  }

  return { success: true };
}

/**
 * Fetch a single update by slug from GitHub
 * Returns null if not found or on error
 */
export async function fetchUpdateBySlug(env: Env, slug: string): Promise<Update | null> {
  if (!env.GITHUB_TOKEN) return null;

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${UPDATES_DATA_PATH}/${slug}.json`;
  const response = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) });

  if (!response.ok) return null;

  const fileData = await response.json() as { content: string };
  try {
    // GitHub returns content as Base64-encoded UTF-8
    const decoded = atob(fileData.content.replace(/\n/g, ''));
    return JSON.parse(decoded) as Update;
  } catch {
    return null;
  }
}

/**
 * Fetch all image files for an update from GitHub
 * Returns an empty array if no images directory exists
 */
export async function fetchImages(env: Env, slug: string): Promise<GitHubFileEntry[]> {
  if (!env.GITHUB_TOKEN) return [];

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${IMAGES_PATH}/${slug}`;
  const response = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) });

  if (!response.ok) return [];

  const files = await response.json() as GitHubFileEntry[];
  return files.filter(f => f.type === 'file');
}

/**
 * Save (create or update) an update JSON file on GitHub
 * GET-then-PUT pattern: retrieves existing SHA for updates, omits SHA for new files
 * Retries once on 409 Conflict (SHA race condition)
 */
export async function saveUpdateFile(
  env: Env,
  slug: string,
  update: Update,
  retryCount = 0
): Promise<{ success: boolean; error?: string }> {
  if (!env.GITHUB_TOKEN) {
    return { success: false, error: 'GitHub token not configured' };
  }

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${UPDATES_DATA_PATH}/${slug}.json`;

  // GET existing file to retrieve SHA (required for updates, not for new files)
  const getResponse = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) });
  let existingSha: string | undefined;
  if (getResponse.ok) {
    const fileData = await getResponse.json() as { sha: string };
    existingSha = fileData.sha;
  } else if (getResponse.status !== 404) {
    return { success: false, error: `GitHub API error: ${getResponse.status}` };
  }

  const content = encodeBase64(JSON.stringify(update, null, 2));
  const putBody: Record<string, string> = {
    message: existingSha ? `Update: ${update.title}` : `Add update: ${update.title}`,
    content,
  };
  if (existingSha) putBody.sha = existingSha;

  const putResponse = await fetch(url, {
    method: 'PUT',
    headers: { ...githubHeaders(env.GITHUB_TOKEN), 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody),
  });

  if (putResponse.status === 409 && retryCount === 0) {
    // SHA conflict — retry once with a fresh GET
    return saveUpdateFile(env, slug, update, 1);
  }

  if (!putResponse.ok) {
    const err = await putResponse.text();
    return { success: false, error: `GitHub API error: ${putResponse.status} - ${err}` };
  }

  return { success: true };
}

/**
 * Upload an image file for an update to GitHub
 * Stored at public/images/updates/{slug}/{filename}
 * Returns the public path to the image
 */
export async function uploadImageFile(
  env: Env,
  slug: string,
  filename: string,
  imageBytes: Uint8Array
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (!env.GITHUB_TOKEN) {
    return { success: false, error: 'GitHub token not configured' };
  }

  const filePath = `${IMAGES_PATH}/${slug}/${filename}`;
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${filePath}`;

  // Check if file already exists (to get SHA for overwrite)
  const getResponse = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) });
  let existingSha: string | undefined;
  if (getResponse.ok) {
    const fileData = await getResponse.json() as { sha: string };
    existingSha = fileData.sha;
  }

  let binary = '';
  imageBytes.forEach(b => { binary += String.fromCharCode(b); });
  const content = btoa(binary);

  const putBody: Record<string, string> = {
    message: `Add image ${filename} to update: ${slug}`,
    content,
  };
  if (existingSha) putBody.sha = existingSha;

  const putResponse = await fetch(url, {
    method: 'PUT',
    headers: { ...githubHeaders(env.GITHUB_TOKEN), 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody),
  });

  if (!putResponse.ok) {
    return { success: false, error: `GitHub API error: ${putResponse.status}` };
  }

  return { success: true, path: `/images/updates/${slug}/${filename}` };
}

/**
 * Delete a single image file for an update from GitHub
 */
export async function deleteImageFile(
  env: Env,
  slug: string,
  filename: string
): Promise<{ success: boolean; error?: string }> {
  if (!env.GITHUB_TOKEN) {
    return { success: false, error: 'GitHub token not configured' };
  }

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${IMAGES_PATH}/${slug}/${filename}`;

  const getResponse = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) });
  if (!getResponse.ok) {
    return { success: false, error: getResponse.status === 404 ? 'Image not found' : `GitHub API error: ${getResponse.status}` };
  }

  const fileData = await getResponse.json() as { sha: string };

  const deleteResponse = await fetch(url, {
    method: 'DELETE',
    headers: { ...githubHeaders(env.GITHUB_TOKEN), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Delete image ${filename} from update: ${slug}`, sha: fileData.sha }),
  });

  if (!deleteResponse.ok) {
    return { success: false, error: `Failed to delete: ${deleteResponse.status}` };
  }

  return { success: true };
}

/**
 * Delete all image files for an update from GitHub
 * Silently succeeds if no images directory exists
 */
export async function deleteImagesDirectory(env: Env, slug: string): Promise<void> {
  if (!env.GITHUB_TOKEN) return;

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${IMAGES_PATH}/${slug}`;

  const response = await fetch(url, {
    headers: githubHeaders(env.GITHUB_TOKEN),
  });

  if (!response.ok) return; // No images directory, nothing to do

  const files = await response.json() as GitHubFileEntry[];

  await Promise.all(
    files.map(async (file) => {
      try {
        await fetch(file.url, {
          method: 'DELETE',
          headers: {
            ...githubHeaders(env.GITHUB_TOKEN!),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Delete image from update: ${slug}`,
            sha: file.sha,
          }),
        });
      } catch {
        console.error(`Failed to delete image ${file.name} for update ${slug}`);
      }
    })
  );
}
