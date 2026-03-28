// ABOUT: Proxy endpoint for GitHub GraphQL API to fetch contribution data
// ABOUT: Keeps GitHub personal access token secure on the server side

import type { Env } from '../types';
import { checkRateLimit } from '../auth';

/**
 * Handles GitHub GraphQL API requests for contribution data
 * GET /api/github/contributions?username={username}
 */
export async function handleGitHubContributions(
  request: Request,
  env: Env
): Promise<Response> {
  // Restrict CORS to allowed origins only (prevents quota abuse)
  const origin = request.headers.get('Origin');
  const allowedOrigins = ['https://hultberg.org', 'http://localhost:8787'];
  const allowOrigin = (origin && allowedOrigins.includes(origin))
    ? origin
    : 'https://hultberg.org';

  // CORS headers for client-side access
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting (10 requests per minute per IP)
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitExceeded = await checkRateLimit(env, clientIP);
  if (rateLimitExceeded) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Extract username from query params
  const url = new URL(request.url);
  const username = url.searchParams.get('username');

  if (!username) {
    return new Response(
      JSON.stringify({ error: 'Missing username parameter' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate username format (GitHub usernames: alphanumeric and hyphens, 1-39 chars)
  // May not start/end with hyphen, no consecutive hyphens
  const usernameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  if (!usernameRegex.test(username)) {
    return new Response(
      JSON.stringify({ error: 'Invalid username format' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Check for GitHub token
  if (!env.GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'GitHub token not configured' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Calculate date range for last 12 months
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);

  // GraphQL query for contribution data
  const query = `
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'hultberg-org-worker',
      },
      body: JSON.stringify({
        query,
        variables: {
          username,
          from: from.toISOString(),
          to: to.toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const data = await response.json();

    // Return the contribution data
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    // Log detailed error server-side for debugging
    console.error('GitHub API error:', error);

    // Return generic error to client (don't leak implementation details)
    return new Response(
      JSON.stringify({
        error: 'Unable to load GitHub data. Please try again later.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
