// ABOUT: Email sending utilities using Resend.com API
// ABOUT: Handles magic link emails for authentication

import type { Env } from './types';

/**
 * Send magic link email via Resend.com
 * Returns true if successful, false if failed
 */
export async function sendMagicLinkEmail(
  env: Env,
  email: string,
  token: string,
  origin: string
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  const magicLink = `${origin}/admin/api/verify-token?token=${token}`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your admin login link</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin: 20px 0;">
    <h1 style="margin-top: 0; color: #212529; font-size: 24px;">Admin Login</h1>

    <p style="font-size: 16px; margin: 20px 0;">
      Click the button below to log in to your admin dashboard:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${magicLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">
        Log In to Admin
      </a>
    </div>

    <p style="font-size: 14px; color: #6c757d; margin: 20px 0;">
      Or copy and paste this link into your browser:
    </p>

    <p style="font-size: 13px; background-color: #e9ecef; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace;">
      ${magicLink}
    </p>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

    <p style="font-size: 13px; color: #6c757d; margin: 10px 0;">
      <strong>Security note:</strong> This link will expire in 15 minutes and can only be used once.
    </p>

    <p style="font-size: 13px; color: #6c757d; margin: 10px 0;">
      If you didn't request this login link, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hultberg.org Admin <noreply@hultberg.org>',
        to: email,
        subject: 'Your admin login link',
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}
