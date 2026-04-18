// ABOUT: Auth-gated debug endpoint — Worker equivalent of tests/fixtures verify-gsc.mjs.
// ABOUT: Runs the GSC auth flow, lists sites, and returns the result as JSON. Kept as
// ABOUT: an ops endpoint so we can smoke-test the service account after secret rotation.

import type { Env } from '@/types';
import { requireAuth } from '@/auth';
import { GSCClient } from '@/gsc';
import { sanitiseUpstreamError } from '@/gscHelpers';

const SITE_URL = 'sc-domain:hultberg.org';

export async function handleGscDebug(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  if (!env.GSC_SERVICE_ACCOUNT_JSON) {
    return json({ ok: false, error: 'GSC_SERVICE_ACCOUNT_JSON not configured' }, 500);
  }

  try {
    const client = GSCClient.fromSecret(env.GSC_SERVICE_ACCOUNT_JSON, SITE_URL);
    const sites = await client.listSites();
    const sitemaps = await client.listSitemaps();
    return json({ ok: true, siteUrl: SITE_URL, sites, sitemaps });
  } catch (err) {
    // Sanitise before returning over HTTP — auth-gated, but don't echo full upstream bodies.
    console.error('gsc-debug failed:', err);
    return json({ ok: false, error: sanitiseUpstreamError(err) }, 500);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
