// ABOUT: POST /admin/api/refresh-gsc — manually triggers the GSC poll.
// ABOUT: Uses skipDispatch so refreshing from the dashboard doesn't send emails
// ABOUT: as a side effect (email is a cron-only behaviour). Rate-limited via
// ABOUT: RATE_LIMIT_KV to prevent runaway clicks racing with the cron.

import type { Env } from '@/types';
import { requireAuth } from '@/auth';
import { runDailyPoll } from '@/scheduled';
import { sanitiseUpstreamError } from '@/gscHelpers';

const RATE_LIMIT_SECONDS = 60;

export async function handleRefreshGsc(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'Forbidden' }, 403);
  }

  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  if (env.RATE_LIMIT_KV) {
    const existing = await env.RATE_LIMIT_KV.get('gsc-refresh');
    if (existing) {
      return json({
        ok: false,
        error: `Refresh already ran within the last ${RATE_LIMIT_SECONDS}s — try again shortly.`,
      }, 429);
    }
    await env.RATE_LIMIT_KV.put('gsc-refresh', new Date().toISOString(), {
      expirationTtl: RATE_LIMIT_SECONDS,
    });
  }

  try {
    // skipDispatch: compute + persist, but do not send emails. Email is a
    // cron-only side effect — a user clicking "Refresh" shouldn't be surprised
    // by an alert email arriving in their inbox.
    const snapshot = await runDailyPoll(env, { skipDispatch: true });
    return json({ ok: true, snapshot });
  } catch (err) {
    console.error('refresh-gsc failed:', sanitiseUpstreamError(err));
    return json({ ok: false, error: sanitiseUpstreamError(err) }, 500);
  }
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
