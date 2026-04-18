// ABOUT: Unit tests for the GSC API client.
// ABOUT: Mocks global fetch to verify request shapes and response handling.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GSCClient } from '@/gsc';

const privateKeyPem = readFileSync(
  join(__dirname, '..', 'fixtures', 'test-private-key.pem'),
  'utf8',
);

const SITE_URL = 'sc-domain:hultberg.org';

function makeKeyJson(): string {
  return JSON.stringify({
    client_email: 'test-sa@example.iam.gserviceaccount.com',
    private_key: privateKeyPem,
    type: 'service_account',
  });
}

function mockSuccess(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GSCClient.fromSecret', () => {
  it('throws a clear error when the JSON is malformed', () => {
    expect(() => GSCClient.fromSecret('not-json', SITE_URL)).toThrow(/not valid JSON/);
  });

  it('throws when client_email is missing', () => {
    const json = JSON.stringify({ private_key: privateKeyPem });
    expect(() => GSCClient.fromSecret(json, SITE_URL)).toThrow(/missing client_email/);
  });

  it('throws when private_key is missing', () => {
    const json = JSON.stringify({ client_email: 'x@y.iam.gserviceaccount.com' });
    expect(() => GSCClient.fromSecret(json, SITE_URL)).toThrow(/missing.*private_key/);
  });

  it('returns a client when the JSON is well-formed', () => {
    const client = GSCClient.fromSecret(makeKeyJson(), SITE_URL);
    expect(client.siteUrl).toBe(SITE_URL);
  });
});

describe('GSCClient.getAccessToken', () => {
  let client: GSCClient;
  beforeEach(() => {
    client = GSCClient.fromSecret(makeKeyJson(), SITE_URL);
  });

  it('POSTs a JWT bearer assertion to the token endpoint', async () => {
    const fetchSpy = vi.fn(async () => mockSuccess({ access_token: 't1', expires_in: 3600 }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const token = await client.getAccessToken();

    expect(token).toBe('t1');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = (fetchSpy.mock.calls as unknown as Array<[string, RequestInit]>)[0];
    expect(call[0]).toBe('https://oauth2.googleapis.com/token');
    const init = call[1];
    expect(init.method).toBe('POST');
    const bodyString = init.body?.toString() ?? '';
    expect(bodyString).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
    expect(bodyString).toContain('assertion=');
  });

  it('caches the access token for subsequent calls', async () => {
    const fetchSpy = vi.fn(async () => mockSuccess({ access_token: 't-cached', expires_in: 3600 }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const a = await client.getAccessToken();
    const b = await client.getAccessToken();

    expect(a).toBe('t-cached');
    expect(b).toBe('t-cached');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throws a descriptive error on token-exchange failure', async () => {
    global.fetch = vi.fn(async () => new Response('bad grant', { status: 400 })) as unknown as typeof fetch;

    await expect(client.getAccessToken()).rejects.toThrow(/token exchange failed \(400\)/);
  });
});

describe('GSCClient API methods', () => {
  let client: GSCClient;
  beforeEach(() => {
    client = GSCClient.fromSecret(makeKeyJson(), SITE_URL);
  });

  function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
    global.fetch = vi.fn(async (input: RequestInfo | URL | string, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === 'https://oauth2.googleapis.com/token') {
        return mockSuccess({ access_token: 'test-token', expires_in: 3600 });
      }
      return handler(url, init);
    }) as unknown as typeof fetch;
  }

  it('listSitemaps calls the sitemaps endpoint with a URL-encoded siteUrl', async () => {
    let capturedUrl = '';
    let capturedAuth = '';
    mockFetch((url, init) => {
      capturedUrl = url;
      capturedAuth = (init?.headers as Record<string, string>)?.Authorization ?? '';
      return mockSuccess({ sitemap: [{ path: 'https://hultberg.org/sitemap.xml', errors: 0, warnings: 1 }] });
    });

    const sitemaps = await client.listSitemaps();

    expect(capturedUrl).toBe(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/sitemaps`,
    );
    expect(capturedAuth).toBe('Bearer test-token');
    expect(sitemaps).toHaveLength(1);
    expect(sitemaps[0].warnings).toBe(1);
  });

  it('listSitemaps returns [] when the response has no sitemap key', async () => {
    mockFetch(() => mockSuccess({}));
    expect(await client.listSitemaps()).toEqual([]);
  });

  it('queryAnalytics POSTs the query body', async () => {
    let capturedBody = '';
    mockFetch((_url, init) => {
      capturedBody = init?.body?.toString() ?? '';
      return mockSuccess({
        rows: [
          { keys: ['magnus hultberg'], clicks: 145, impressions: 3204, ctr: 0.045, position: 2.1 },
        ],
      });
    });

    const rows = await client.queryAnalytics({
      startDate: '2026-03-01',
      endDate: '2026-03-28',
      dimensions: ['query'],
      rowLimit: 5,
    });

    expect(JSON.parse(capturedBody)).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-28',
      dimensions: ['query'],
      rowLimit: 5,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].clicks).toBe(145);
  });

  it('queryAnalytics returns [] when rows are absent', async () => {
    mockFetch(() => mockSuccess({}));
    expect(await client.queryAnalytics({ startDate: '2026-03-01', endDate: '2026-03-28' })).toEqual([]);
  });

  it('listSites returns the siteEntry array', async () => {
    mockFetch(() => mockSuccess({
      siteEntry: [
        { siteUrl: 'sc-domain:hultberg.org', permissionLevel: 'siteFullUser' },
        { siteUrl: 'http://hultberg.org/', permissionLevel: 'siteOwner' },
      ],
    }));

    const sites = await client.listSites();

    expect(sites).toHaveLength(2);
    expect(sites[0].siteUrl).toBe('sc-domain:hultberg.org');
  });

  it('inspectUrl POSTs to the urlInspection endpoint with siteUrl + inspectionUrl', async () => {
    let capturedUrl = '';
    let capturedBody = '';
    mockFetch((url, init) => {
      capturedUrl = url;
      capturedBody = init?.body?.toString() ?? '';
      return mockSuccess({ inspectionResult: { indexStatusResult: { verdict: 'PASS' } } });
    });

    await client.inspectUrl('https://hultberg.org/updates/newer-update');

    expect(capturedUrl).toBe('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect');
    expect(JSON.parse(capturedBody)).toEqual({
      inspectionUrl: 'https://hultberg.org/updates/newer-update',
      siteUrl: SITE_URL,
    });
  });

  it('API methods bubble up descriptive errors on non-success', async () => {
    mockFetch(() => new Response('forbidden', { status: 403 }));
    await expect(client.listSitemaps()).rejects.toThrow(/403/);
  });
});
