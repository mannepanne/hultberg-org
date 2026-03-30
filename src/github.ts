// ABOUT: GitHub API utilities for reading and writing update files
// ABOUT: Wraps GitHub Contents API for listing, fetching, saving, and deleting updates and images

import type { Env, Update, NowSnapshot, NowSnapshotsIndex, NowSnapshotIndexEntry } from './types';
import { encodeBase64, decodeBase64 } from './utils';

export const GITHUB_REPO = 'mannepanne/hultberg-org';
const GITHUB_API_BASE = 'https://api.github.com';
const UPDATES_DATA_PATH = 'public/updates/data';
const IMAGES_PATH = 'public/images/updates';
const NOW_CONTENT_PATH = 'public/now/data/content.json';
const NOW_SNAPSHOTS_PATH = 'public/now/snapshots';
const NOW_SNAPSHOTS_INDEX_PATH = 'public/now/snapshots/index.json';

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
    const base64 = fileData.content.replace(/\n/g, '');
    const decoded = decodeBase64(base64);
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

/**
 * Save /now page content to GitHub
 * Updates public/now/data/content.json with new markdown and timestamp
 * GET-then-PUT pattern: retrieves existing SHA, retries once on conflict
 */
export async function saveNowContent(
  env: Env,
  content: { markdown: string; lastUpdated: string },
  retryCount = 0
): Promise<{ success: boolean; error?: string }> {
  if (!env.GITHUB_TOKEN) {
    return { success: false, error: 'GitHub token not configured' };
  }

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${NOW_CONTENT_PATH}`;

  // GET existing file to retrieve SHA
  const getResponse = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) });
  let existingSha: string | undefined;
  if (getResponse.ok) {
    const fileData = await getResponse.json() as { sha: string };
    existingSha = fileData.sha;
  } else if (getResponse.status !== 404) {
    return { success: false, error: `GitHub API error: ${getResponse.status}` };
  }

  const encodedContent = encodeBase64(JSON.stringify(content, null, 2));
  const putBody: Record<string, string> = {
    message: `Update /now page content\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`,
    content: encodedContent,
  };
  if (existingSha) putBody.sha = existingSha;

  const putResponse = await fetch(url, {
    method: 'PUT',
    headers: { ...githubHeaders(env.GITHUB_TOKEN), 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody),
  });

  if (putResponse.status === 409 && retryCount === 0) {
    // SHA conflict — retry once with a fresh GET
    return saveNowContent(env, content, 1);
  }

  if (!putResponse.ok) {
    const err = await putResponse.text();
    return { success: false, error: `GitHub API error: ${putResponse.status} - ${err}` };
  }

  return { success: true };
}

/**
 * Fetch snapshots index from GitHub
 * Returns the index or an empty index if not found
 */
async function fetchSnapshotsIndex(env: Env): Promise<NowSnapshotsIndex> {
  if (!env.GITHUB_TOKEN) {
    return { snapshots: [] };
  }

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${NOW_SNAPSHOTS_INDEX_PATH}`;
  const response = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) });

  if (!response.ok) {
    return { snapshots: [] };
  }

  const fileData = await response.json() as { content: string };
  const decoded = decodeBase64(fileData.content);
  return JSON.parse(decoded) as NowSnapshotsIndex;
}

/**
 * Save snapshots index to GitHub
 */
async function saveSnapshotsIndex(
  env: Env,
  index: NowSnapshotsIndex,
  retryCount = 0
): Promise<{ success: boolean; error?: string }> {
  if (!env.GITHUB_TOKEN) {
    return { success: false, error: 'GitHub token not configured' };
  }

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${NOW_SNAPSHOTS_INDEX_PATH}`;

  // GET existing file to retrieve SHA
  const getResponse = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) });
  let existingSha: string | undefined;
  if (getResponse.ok) {
    const fileData = await getResponse.json() as { sha: string };
    existingSha = fileData.sha;
  } else if (getResponse.status !== 404) {
    return { success: false, error: `GitHub API error: ${getResponse.status}` };
  }

  const encodedContent = encodeBase64(JSON.stringify(index, null, 2));
  const putBody: Record<string, string> = {
    message: `Update /now snapshots index\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`,
    content: encodedContent,
  };
  if (existingSha) putBody.sha = existingSha;

  const putResponse = await fetch(url, {
    method: 'PUT',
    headers: { ...githubHeaders(env.GITHUB_TOKEN), 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody),
  });

  if (putResponse.status === 409 && retryCount === 0) {
    return saveSnapshotsIndex(env, index, 1);
  }

  if (!putResponse.ok) {
    const err = await putResponse.text();
    return { success: false, error: `GitHub API error: ${putResponse.status} - ${err}` };
  }

  return { success: true };
}

/**
 * Save a /now page snapshot to GitHub
 * Creates snapshot file and updates index
 */
export async function saveNowSnapshot(
  env: Env,
  date: string, // YYYYMMDD format
  snapshot: NowSnapshot
): Promise<{ success: boolean; error?: string; overwritten?: boolean }> {
  if (!env.GITHUB_TOKEN) {
    return { success: false, error: 'GitHub token not configured' };
  }

  // Save snapshot file
  const snapshotPath = `${NOW_SNAPSHOTS_PATH}/${date}.json`;
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${snapshotPath}`;

  // Check if snapshot already exists
  const getResponse = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) });
  let existingSha: string | undefined;
  let overwritten = false;
  if (getResponse.ok) {
    const fileData = await getResponse.json() as { sha: string };
    existingSha = fileData.sha;
    overwritten = true;
  } else if (getResponse.status !== 404) {
    return { success: false, error: `GitHub API error: ${getResponse.status}` };
  }

  const encodedContent = encodeBase64(JSON.stringify(snapshot, null, 2));
  const putBody: Record<string, string> = {
    message: overwritten
      ? `Update /now snapshot for ${date}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`
      : `Create /now snapshot for ${date}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`,
    content: encodedContent,
  };
  if (existingSha) putBody.sha = existingSha;

  const putResponse = await fetch(url, {
    method: 'PUT',
    headers: { ...githubHeaders(env.GITHUB_TOKEN), 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody),
  });

  if (!putResponse.ok) {
    const err = await putResponse.text();
    return { success: false, error: `GitHub API error: ${putResponse.status} - ${err}` };
  }

  // Update index
  const index = await fetchSnapshotsIndex(env);
  const preview = snapshot.markdown.substring(0, 150).trim();
  const existingIndex = index.snapshots.findIndex(s => s.date === date);

  const entry: NowSnapshotIndexEntry = {
    date,
    snapshotDate: snapshot.snapshotDate,
    preview,
  };

  if (existingIndex >= 0) {
    index.snapshots[existingIndex] = entry;
  } else {
    index.snapshots.push(entry);
  }

  // Sort by date descending (newest first)
  index.snapshots.sort((a, b) => b.date.localeCompare(a.date));

  const indexResult = await saveSnapshotsIndex(env, index);
  if (!indexResult.success) {
    return indexResult;
  }

  return { success: true, overwritten };
}

/**
 * Delete a /now page snapshot from GitHub
 * Removes snapshot file and updates index
 */
export async function deleteNowSnapshot(
  env: Env,
  date: string // YYYYMMDD format
): Promise<{ success: boolean; error?: string }> {
  if (!env.GITHUB_TOKEN) {
    return { success: false, error: 'GitHub token not configured' };
  }

  // Delete snapshot file
  const snapshotPath = `${NOW_SNAPSHOTS_PATH}/${date}.json`;
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${snapshotPath}`;

  // Get file SHA
  const getResponse = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) });
  if (!getResponse.ok) {
    return { success: false, error: 'Snapshot not found' };
  }

  const fileData = await getResponse.json() as { sha: string };
  const deleteBody = {
    message: `Delete /now snapshot for ${date}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`,
    sha: fileData.sha,
  };

  const deleteResponse = await fetch(url, {
    method: 'DELETE',
    headers: { ...githubHeaders(env.GITHUB_TOKEN), 'Content-Type': 'application/json' },
    body: JSON.stringify(deleteBody),
  });

  if (!deleteResponse.ok) {
    const err = await deleteResponse.text();
    return { success: false, error: `GitHub API error: ${deleteResponse.status} - ${err}` };
  }

  // Update index
  const index = await fetchSnapshotsIndex(env);
  index.snapshots = index.snapshots.filter(s => s.date !== date);

  const indexResult = await saveSnapshotsIndex(env, index);
  if (!indexResult.success) {
    return indexResult;
  }

  return { success: true };
}

/**
 * List all /now page snapshots
 * Returns snapshots index sorted by date (newest first)
 */
export async function listNowSnapshots(env: Env): Promise<NowSnapshotsIndex> {
  return fetchSnapshotsIndex(env);
}
