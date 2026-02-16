// ABOUT: API endpoint for sending magic link emails
// ABOUT: POST /admin/api/send-magic-link - generates token and sends email

import type { Env } from '@/types';
import { generateMagicLinkToken, storeMagicLinkToken, isValidEmail, isAdminEmail, checkRateLimit } from '@/auth';
import { sendMagicLinkEmail } from '@/email';

/**
 * Handle POST /admin/api/send-magic-link
 * Generates magic link token and sends email
 * Always returns success to prevent email enumeration
 */
export async function handleSendMagicLink(request: Request, env: Env): Promise<Response> {
  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Check rate limit
    const isRateLimited = await checkRateLimit(env, clientIP);
    if (isRateLimited) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body = await request.json() as { email?: string };
    const email = body.email?.trim();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email address is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if email matches admin email
    // SECURITY: Always return success to prevent email enumeration
    if (isAdminEmail(env, email)) {
      // Generate and store token
      const token = generateMagicLinkToken();
      await storeMagicLinkToken(env, token, email);

      // Send email
      const url = new URL(request.url);
      const origin = url.origin;
      const emailSent = await sendMagicLinkEmail(env, email, token, origin);

      if (!emailSent) {
        console.error('Failed to send magic link email to:', email);
        // Don't reveal failure to user
      }
    } else {
      // Not admin email, but pretend we sent it (prevent enumeration)
      console.log('Non-admin email attempted login:', email);
    }

    // Always return success
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in handleSendMagicLink:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
