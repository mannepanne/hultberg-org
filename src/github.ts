// ABOUT: GitHub API utilities for reading and writing update files
// ABOUT: Wraps GitHub Contents API for listing, deleting, and (in Phase 6) saving updates

import type { Env } from './types';
import type { Update } from './types';

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
