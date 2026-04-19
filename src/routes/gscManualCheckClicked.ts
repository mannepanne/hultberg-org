// ABOUT: POST /admin/api/gsc-manual-check-clicked — records that the admin
// ABOUT: clicked the "Check Search Console" link in the widget footer. The
// ABOUT: timestamp drives the "Last checked in GSC UI: N days ago" recency
// ABOUT: nudge rendered by the widget.

import type { Env } from '@/types';
import { requireAuth } from '@/auth';

const KV_KEY = 'manual-check:lastClicked';

export async function handleGscManualCheckClicked(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'Forbidden' }, 403);
  }

  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  if (!env.GSC_KV) {
    return json({ ok: false, error: 'GSC_KV binding not configured' }, 500);
  }

  await env.GSC_KV.put(KV_KEY, new Date().toISOString());
  return json({ ok: true });
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
