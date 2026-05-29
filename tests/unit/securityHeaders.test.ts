// ABOUT: Unit tests for the withSecurityHeaders response wrapper
// ABOUT: Validates header injection, CSP preservation, and body/status passthrough

import { describe, it, expect } from 'vitest';
import { withSecurityHeaders, BASE_SECURITY_HEADERS, DEFAULT_CSP } from '@/securityHeaders';

describe('withSecurityHeaders', () => {
  it('adds every base security header', () => {
    const result = withSecurityHeaders(new Response('hello'));

    for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
      expect(result.headers.get(name)).toBe(value);
    }
  });

  it('does not set Strict-Transport-Security (Cloudflare edge owns it)', () => {
    const result = withSecurityHeaders(new Response('hello'));
    expect(result.headers.has('Strict-Transport-Security')).toBe(false);
  });

  it('applies the default CSP when the response has none', () => {
    const result = withSecurityHeaders(new Response('hello'));
    expect(result.headers.get('Content-Security-Policy')).toBe(DEFAULT_CSP);
  });

  it('preserves a route-specific CSP instead of overwriting it', () => {
    const routeCsp = "default-src 'self'; frame-src https://goodreads.com;";
    const source = new Response('hello', {
      headers: { 'Content-Security-Policy': routeCsp },
    });

    const result = withSecurityHeaders(source);
    expect(result.headers.get('Content-Security-Policy')).toBe(routeCsp);
  });

  it('preserves status, statusText, and body', async () => {
    const source = new Response('not here', { status: 404, statusText: 'Not Found' });
    const result = withSecurityHeaders(source);

    expect(result.status).toBe(404);
    expect(result.statusText).toBe('Not Found');
    expect(await result.text()).toBe('not here');
  });

  it('preserves pre-existing unrelated headers such as Content-Type', () => {
    const source = new Response('<p>hi</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    const result = withSecurityHeaders(source);
    expect(result.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
  });

  it('forces X-Frame-Options even when the source set a weaker value', () => {
    const source = new Response('hi', {
      headers: { 'X-Frame-Options': 'SAMEORIGIN' },
    });

    const result = withSecurityHeaders(source);
    expect(result.headers.get('X-Frame-Options')).toBe('DENY');
  });
});
