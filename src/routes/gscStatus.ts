// ABOUT: GET /admin/api/gsc-status — returns the latest GSC snapshot from KV.
// ABOUT: Auth-gated; used by the dashboard widget as its primary data source.

import type { Env, GSCSnapshot } from '@/types';
import { requireAuth } from '@/auth';

export async function handleGscStatus(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  if (!env.GSC_KV) {
    return json({ ok: false, error: 'GSC_KV binding not configured' }, 500);
  }

  const [raw, manualCheckLastClicked] = await Promise.all([
    env.GSC_KV.get('status:latest'),
    env.GSC_KV.get('manual-check:lastClicked'),
  ]);
  if (!raw) {
    // No snapshot yet (cron hasn't fired for the first time). Not an error —
    // widget renders an empty state from this.
    return json({ ok: true, snapshot: null, manualCheckLastClicked });
  }

  let snapshot: GSCSnapshot;
  try {
    snapshot = JSON.parse(raw) as GSCSnapshot;
  } catch {
    return json({ ok: false, error: 'Corrupt snapshot in KV' }, 500);
  }

  return json({ ok: true, snapshot, manualCheckLastClicked });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}
