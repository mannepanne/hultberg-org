// ABOUT: API endpoint for creating /now page snapshots
// ABOUT: POST /admin/api/create-now-snapshot - validates, applies rate limiting, commits to GitHub

import type { Env, NowSnapshot } from '@/types';
import { requireAuth, checkRateLimit } from '@/auth';
import { saveNowSnapshot } from '@/github';

const MAX_CONTENT_BYTES = 100 * 1024; // 100KB

/**
 * Handle POST /admin/api/create-now-snapshot
 * Creates a snapshot of /now page content in GitHub (public/now/snapshots/)
 * Applies rate limiting and validation
 *
 * Request body:
 * - markdown: string (required) - Content for the snapshot
 * - date: string (optional) - YYYYMMDD format, defaults to today if not provided
 *   Must not be in the future. Enables backdating snapshots for migration.
 */
export async function handleCreateNowSnapshot(request: Request, env: Env): Promise<Response> {
  // CSRF protection
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Authentication
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const rateLimited = await checkRateLimit(env, clientIP);
  if (rateLimited) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json() as {
      markdown?: string;
      date?: string;
    };

    // Validate markdown content
    const markdown = body.markdown?.trim();
    if (!markdown) {
      return new Response(JSON.stringify({ error: 'Content cannot be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate content size
    const contentBytes = new TextEncoder().encode(markdown).length;
    if (contentBytes > MAX_CONTENT_BYTES) {
      return new Response(JSON.stringify({ error: 'Content exceeds maximum size of 100KB' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate and process date
    const now = new Date();
    let date: string;
    let snapshotDate: string;

    if (body.date) {
      // Validate date format (YYYYMMDD)
      if (!/^\d{8}$/.test(body.date)) {
        return new Response(JSON.stringify({ error: 'Invalid date format. Expected YYYYMMDD' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Parse and validate date is valid
      const year = parseInt(body.date.substring(0, 4));
      const month = parseInt(body.date.substring(4, 6));
      const day = parseInt(body.date.substring(6, 8));
      const parsedDate = new Date(year, month - 1, day);

      // Check if date is valid (e.g., not Feb 31)
      if (parsedDate.getFullYear() !== year ||
          parsedDate.getMonth() !== month - 1 ||
          parsedDate.getDate() !== day) {
        return new Response(JSON.stringify({ error: 'Invalid date. Date does not exist' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if date is not in the future
      parsedDate.setHours(23, 59, 59, 999); // End of day
      if (parsedDate > now) {
        return new Response(JSON.stringify({ error: 'Cannot create snapshot for future date' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      date = body.date;
      // Use noon on the specified date for snapshotDate
      snapshotDate = new Date(year, month - 1, day, 12, 0, 0).toISOString();
    } else {
      // Default to today
      date = now.toISOString().substring(0, 10).replace(/-/g, '');
      snapshotDate = now.toISOString();
    }

    // Prepare snapshot
    const snapshot: NowSnapshot = {
      markdown,
      snapshotDate,
    };

    // Save to GitHub
    const result = await saveNowSnapshot(env, date, snapshot);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error ?? 'Failed to save snapshot' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      date,
      overwritten: result.overwritten
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in handleCreateNowSnapshot:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
