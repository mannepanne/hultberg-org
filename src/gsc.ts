// ABOUT: Google Search Console API client for Workers runtime.
// ABOUT: Handles service-account auth, token caching, and the endpoints we use:
// ABOUT: sites.list (debug), sitemaps.list, and searchAnalytics.query.

import { signServiceAccountJWT } from '@/jwt';
import { sanitiseUpstreamError } from '@/gscHelpers';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://www.googleapis.com/webmasters/v3';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/**
 * Raw service-account JSON shape. Matches the key file Google hands out;
 * we only touch the two fields we actually need.
 */
export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

export interface SitemapContents {
  type: string; // 'web' | 'image' | 'video' | ...
  submitted: string;
  indexed: string;
}

export interface Sitemap {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  type?: string;
  errors?: number;
  warnings?: number;
  contents?: SitemapContents[];
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsQuery {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  dimensions?: Array<'query' | 'page' | 'country' | 'device' | 'date' | 'searchAppearance'>;
  rowLimit?: number;
}

/**
 * Client for one Search Console property (siteUrl).
 * Holds a cached access token for the lifetime of the instance — one instance
 * per scheduled run is the expected usage.
 */
export class GSCClient {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly key: ServiceAccountKey,
    public readonly siteUrl: string,
  ) {}

  /**
   * Parse a service-account JSON string and return a GSCClient.
   * Surfaces a clear error if the JSON is malformed or missing required fields.
   */
  static fromSecret(serviceAccountJson: string, siteUrl: string): GSCClient {
    let key: ServiceAccountKey;
    try {
      key = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('GSC: service account JSON is not valid JSON');
    }
    if (!key.client_email || !key.private_key) {
      throw new Error('GSC: service account JSON is missing client_email or private_key');
    }
    return new GSCClient(key, siteUrl);
  }

  /**
   * Get a fresh-or-cached OAuth access token for the configured service account.
   * Tokens are valid for ~1h; we refresh when within 5min of expiry.
   */
  async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && this.cachedToken.expiresAt - 300 > now) {
      return this.cachedToken.token;
    }

    const jwt = await signServiceAccountJWT(
      {
        iss: this.key.client_email,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      },
      this.key.private_key,
    );

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GSC: token exchange failed (${response.status}): ${sanitiseUpstreamError(body)}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.cachedToken = {
      token: data.access_token,
      expiresAt: now + data.expires_in,
    };
    return data.access_token;
  }

  /**
   * GET /sites — useful for debug/diagnostic; not used by the scheduled handler.
   */
  async listSites(): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
    const data = await this.call<{ siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> }>(
      'GET',
      '/sites',
    );
    return data.siteEntry ?? [];
  }

  /**
   * GET /sites/{siteUrl}/sitemaps — returns all registered sitemaps + per-sitemap status.
   */
  async listSitemaps(): Promise<Sitemap[]> {
    const data = await this.call<{ sitemap?: Sitemap[] }>(
      'GET',
      `/sites/${encodeURIComponent(this.siteUrl)}/sitemaps`,
    );
    return data.sitemap ?? [];
  }

  /**
   * POST /sites/{siteUrl}/searchAnalytics/query — performance data.
   */
  async queryAnalytics(query: SearchAnalyticsQuery): Promise<SearchAnalyticsRow[]> {
    const data = await this.call<{ rows?: SearchAnalyticsRow[] }>(
      'POST',
      `/sites/${encodeURIComponent(this.siteUrl)}/searchAnalytics/query`,
      query,
    );
    return data.rows ?? [];
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${API_BASE}${path}`, init);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GSC: ${method} ${path} failed (${response.status}): ${sanitiseUpstreamError(text)}`);
    }
    return response.json() as Promise<T>;
  }
}
