// ABOUT: Unit tests for the email notifier.
// ABOUT: Verifies CF Email Sending path, Resend fallback, and failure modes.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock cloudflare:email — not available in the Node test runtime.
vi.mock('cloudflare:email', () => {
  class EmailMessage {
    constructor(
      public readonly from: string,
      public readonly to: string,
      public readonly raw: string,
    ) {}
  }
  return { EmailMessage };
});

import { sendAlert, buildMimeMessage } from '@/notifier';
import { createMockEnv } from '../mocks/env';

describe('buildMimeMessage', () => {
  it('produces an RFC 822 message with expected headers and body', () => {
    const mime = buildMimeMessage({
      from: 'alerts@hultberg.org',
      to: 'magnus@example.com',
      subject: 'Test alert',
      body: 'Line one\nLine two',
    });

    expect(mime).toContain('From: alerts@hultberg.org');
    expect(mime).toContain('To: magnus@example.com');
    expect(mime).toContain('Subject: Test alert');
    expect(mime).toContain('MIME-Version: 1.0');
    expect(mime).toContain('Content-Type: text/plain; charset=utf-8');
    expect(mime).toContain('Line one\nLine two');
    expect(mime).toMatch(/Date: .+ GMT/);
    // Headers terminated by CRLF CRLF before the body.
    expect(mime).toContain('\r\n\r\n');
  });

  it('strips CR and LF from subject so injected tokens never start a new header line', () => {
    const mime = buildMimeMessage({
      from: 'alerts@hultberg.org',
      to: 'magnus@example.com',
      subject: 'legit\r\nX-Injected: evil\r\nAlso-Injected: bad',
      body: 'body',
    });
    const lines = mime.split('\r\n');
    // The attacker headers must not appear as their own lines.
    expect(lines.some((l) => l.startsWith('X-Injected:'))).toBe(false);
    expect(lines.some((l) => l.startsWith('Also-Injected:'))).toBe(false);
    // The sanitised subject collapses the tokens into a single header value.
    expect(lines.find((l) => l.startsWith('Subject:'))).toBe('Subject: legit X-Injected: evil Also-Injected: bad');
  });

  it('strips CR and LF from from/to headers so no injected header survives on its own line', () => {
    const mime = buildMimeMessage({
      from: 'alerts@hultberg.org\r\nBcc: sneaky@evil.test',
      to: 'magnus@example.com\r\nBcc: also-sneaky@evil.test',
      subject: 'ok',
      body: 'body',
    });
    // Injected tokens survive as substrings of the collapsed From/To header values
    // (stripCRLF replaces with spaces). The security guarantee is that no NEW header
    // line starts with Bcc: — only that From/To fields carry the sanitised text.
    const lines = mime.split('\r\n');
    expect(lines.some((l) => l.startsWith('Bcc:'))).toBe(false);
    // Confirm injected content ended up inside the legitimate headers as a substring.
    expect(lines.find((l) => l.startsWith('From:'))).toContain('Bcc: sneaky@evil.test');
    expect(lines.find((l) => l.startsWith('To:'))).toContain('Bcc: also-sneaky@evil.test');
  });
});

describe('sendAlert', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
  });

  it('returns provider=none when ADMIN_EMAIL is not configured', async () => {
    const env = createMockEnv({ ADMIN_EMAIL: undefined });

    const result = await sendAlert(env, { subject: 'x', body: 'y' });

    expect(result.provider).toBe('none');
    expect(result.error).toContain('ADMIN_EMAIL');
  });

  it('uses CF Email Sending when the binding is present and succeeds', async () => {
    const sendMock = vi.fn(async () => undefined);
    const env = createMockEnv({
      ADMIN_EMAIL: 'magnus@example.com',
      SEND_EMAIL: { send: sendMock } as any,
    });

    const result = await sendAlert(env, { subject: 'Test', body: 'Hello' });

    expect(result).toEqual({ provider: 'cf' });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const msg = (sendMock.mock.calls as any[])[0][0];
    expect(msg.from).toBe('alerts@hultberg.org');
    expect(msg.to).toBe('magnus@example.com');
    expect(msg.raw).toContain('Subject: Test');
    expect(msg.raw).toContain('Hello');
  });

  it('falls back to Resend when CF Email Sending throws', async () => {
    const sendMock = vi.fn(async () => {
      throw new Error('beta service blew up');
    });
    const resendSpy = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }));
    global.fetch = resendSpy as unknown as typeof fetch;

    const env = createMockEnv({
      ADMIN_EMAIL: 'magnus@example.com',
      SEND_EMAIL: { send: sendMock } as any,
      RESEND_API_KEY: 'test-resend-key',
    });

    const result = await sendAlert(env, { subject: 'Test', body: 'Hello' });

    expect(result).toEqual({ provider: 'resend' });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(resendSpy).toHaveBeenCalledTimes(1);
    const resendCall = (resendSpy.mock.calls as any[])[0];
    expect(resendCall[0]).toBe('https://api.resend.com/emails');
  });

  it('falls back to Resend when SEND_EMAIL binding is absent entirely', async () => {
    const resendSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    global.fetch = resendSpy as unknown as typeof fetch;

    const env = createMockEnv({
      ADMIN_EMAIL: 'magnus@example.com',
      SEND_EMAIL: undefined,
      RESEND_API_KEY: 'test-resend-key',
    });

    const result = await sendAlert(env, { subject: 'Test', body: 'Hello' });

    expect(result.provider).toBe('resend');
    expect(resendSpy).toHaveBeenCalledTimes(1);
  });

  it('returns provider=none when both CF and Resend fail', async () => {
    const sendMock = vi.fn(async () => {
      throw new Error('cf down');
    });
    const failingFetch = vi.fn(async () => new Response('server error', { status: 500 }));
    global.fetch = failingFetch as unknown as typeof fetch;

    const env = createMockEnv({
      ADMIN_EMAIL: 'magnus@example.com',
      SEND_EMAIL: { send: sendMock } as any,
      RESEND_API_KEY: 'test-resend-key',
    });

    const result = await sendAlert(env, { subject: 'Test', body: 'Hello' });

    expect(result.provider).toBe('none');
    expect(result.error).toContain('Both');
  });

  it('passes the alert subject and body through to the CF binding verbatim', async () => {
    const sendMock = vi.fn(async () => undefined);
    const env = createMockEnv({
      ADMIN_EMAIL: 'magnus@example.com',
      SEND_EMAIL: { send: sendMock } as any,
    });

    await sendAlert(env, {
      subject: '⚠️ Indexed count dropped 22%',
      body: 'Previous: 50 pages\nCurrent: 39 pages\nFirst detected 2026-04-17',
    });

    const msg = (sendMock.mock.calls as any[])[0][0];
    expect(msg.raw).toContain('Subject: ⚠️ Indexed count dropped 22%');
    expect(msg.raw).toContain('Previous: 50 pages');
    expect(msg.raw).toContain('First detected 2026-04-17');
  });
});
