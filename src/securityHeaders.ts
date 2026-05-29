// ABOUT: Centralised security response headers for every Worker response.
// ABOUT: Adds the standard hardening headers and a default CSP when a route sets none.

// The four headers every response should carry. Strict-Transport-Security is
// deliberately absent: Cloudflare's edge already injects HSTS on this zone, so
// setting it here would produce a duplicate header.
export const BASE_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()',
};

// Applied only to responses that do not already declare their own CSP. Matches
// the policy the dynamic routes set individually: allows the Cloudflare
// analytics beacon and inline style attributes, blocks everything else.
export const DEFAULT_CSP =
  "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self';";

/**
 * Returns a copy of the response with the standard security headers applied.
 * Existing headers (including a route-specific Content-Security-Policy) are
 * preserved; only the base hardening headers are forced, and the default CSP
 * is added solely when the response carries none.
 */
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  if (!headers.has('Content-Security-Policy')) {
    headers.set('Content-Security-Policy', DEFAULT_CSP);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
