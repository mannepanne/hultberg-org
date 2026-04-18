// ABOUT: Email notification abstraction with Cloudflare Email Sending (beta) first,
// ABOUT: Resend fallback second. Used for GSC alerts; magic-link auth still goes
// ABOUT: directly through Resend (src/email.ts) until CF Email Sending is GA.
//
// The Workers binding for Cloudflare Email Sending uses the EmailMessage/MIME
// shape from @cloudflare/workers-types. The object-style API shown in CF's
// announcement blog post applies to the REST/SMTP surfaces, not the Worker binding.

import { EmailMessage } from 'cloudflare:email';
import type { Env } from './types';
import { sendViaResend } from './email';
import { sanitiseUpstreamError } from './gscHelpers';

const ALERT_FROM = 'alerts@hultberg.org';
const ALERT_FROM_DISPLAY = 'Hultberg.org Alerts <alerts@hultberg.org>';

export interface Alert {
  subject: string;
  body: string; // plain text; rendered as <pre> in the HTML fallback
}

export type NotifierProvider = 'cf' | 'resend' | 'none';

export interface NotifierResult {
  provider: NotifierProvider;
  error?: string;
}

/**
 * Send an alert to the admin recipient via CF Email Sending, falling back to
 * Resend on any failure or when the binding is unavailable.
 */
export async function sendAlert(env: Env, alert: Alert): Promise<NotifierResult> {
  const to = env.ADMIN_EMAIL;
  if (!to) {
    return { provider: 'none', error: 'ADMIN_EMAIL not configured' };
  }

  if (env.SEND_EMAIL) {
    try {
      const mime = buildMimeMessage({
        from: ALERT_FROM,
        to,
        subject: alert.subject,
        body: alert.body,
      });
      await env.SEND_EMAIL.send(new EmailMessage(ALERT_FROM, to, mime));
      return { provider: 'cf' };
    } catch (err) {
      console.warn(`Notifier: CF Email Sending failed (${sanitiseUpstreamError(err)}); falling back to Resend`);
    }
  }

  const ok = await sendViaResend(env, {
    from: ALERT_FROM_DISPLAY,
    to,
    subject: alert.subject,
    html: htmlFromText(alert.body),
  });
  if (ok) {
    return { provider: 'resend' };
  }
  return { provider: 'none', error: 'Both CF Email Sending and Resend failed' };
}

/**
 * Build a minimal RFC 822 MIME message for a plain-text alert.
 * Exported for testing — pure string transformation.
 *
 * Header fields (from/to/subject) are sanitised to strip CR and LF so that
 * future callers with user-controlled input can't inject additional headers
 * or prematurely end the header section.
 */
export function buildMimeMessage(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): string {
  const from = stripCRLF(params.from);
  const to = stripCRLF(params.to);
  const subject = stripCRLF(params.subject);
  const date = new Date().toUTCString();
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    params.body,
    '',
  ].join('\r\n');
}

function stripCRLF(s: string): string {
  return s.replace(/[\r\n]/g, ' ');
}

function htmlFromText(body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap;margin:0">${escaped}</pre>`;
}
