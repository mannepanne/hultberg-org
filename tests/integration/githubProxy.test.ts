// ABOUT: Integration tests for GitHub API proxy endpoint
// ABOUT: Tests GraphQL contribution data fetching with proper error handling and security

import { describe, it, expect, beforeEach } from 'vitest';
import { handleGitHubContributions } from '../../src/routes/githubProxy';
import { createMockEnv } from '../mocks/env';
import type { Env } from '../../src/types';

describe('GET /api/github/contributions', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
  });

  it('returns 400 when username parameter is missing', async () => {
    const request = new Request('http://localhost/api/github/contributions');
    const response = await handleGitHubContributions(request, mockEnv);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('Missing username parameter');
  });

  it('returns 400 when username parameter is empty', async () => {
    const request = new Request('http://localhost/api/github/contributions?username=');
    const response = await handleGitHubContributions(request, mockEnv);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('Missing username parameter');
  });

  it('returns 400 when username has invalid format', async () => {
    const invalidUsernames = [
      '-startwithhyphen',
      'endwithhyphen-',
      'double--hyphen',
      'special@chars',
      'has spaces',
      'way_too_long_username_that_exceeds_39_characters_limit',
    ];

    for (const invalidUsername of invalidUsernames) {
      const request = new Request(`http://localhost/api/github/contributions?username=${encodeURIComponent(invalidUsername)}`);
      const response = await handleGitHubContributions(request, mockEnv);

      expect(response.status).toBe(400);
      const body = await response.json() as { error: string };
      expect(body.error).toBe('Invalid username format');
    }
  });

  it('accepts valid username formats', async () => {
    const validUsernames = ['user', 'user123', 'user-name', 'a1-b2-c3'];

    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://api.github.com/graphql') {
        return new Response(JSON.stringify({
          data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] } } } }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input);
    };

    for (const validUsername of validUsernames) {
      const request = new Request(`http://localhost/api/github/contributions?username=${validUsername}`);
      const response = await handleGitHubContributions(request, mockEnv);
      expect(response.status).toBe(200);
    }

    global.fetch = originalFetch;
  });

  it('returns 500 when GITHUB_TOKEN is not configured', async () => {
    const envWithoutToken = createMockEnv({ GITHUB_TOKEN: undefined });
    const request = new Request('http://localhost/api/github/contributions?username=testuser');
    const response = await handleGitHubContributions(request, envWithoutToken);

    expect(response.status).toBe(500);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('GitHub token not configured');
  });

  it('returns correct CORS headers on GET request', async () => {
    const request = new Request('http://localhost/api/github/contributions?username=testuser');

    // Mock fetch to return successful response
    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://api.github.com/graphql') {
        return new Response(JSON.stringify({
          data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] } } } }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input);
    };

    const response = await handleGitHubContributions(request, mockEnv);
    global.fetch = originalFetch;

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });

  it('handles OPTIONS preflight request', async () => {
    const request = new Request('http://localhost/api/github/contributions', {
      method: 'OPTIONS',
    });
    const response = await handleGitHubContributions(request, mockEnv);

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });

  it('includes cache control header', async () => {
    const request = new Request('http://localhost/api/github/contributions?username=testuser');

    // Mock fetch to return successful response
    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://api.github.com/graphql') {
        return new Response(JSON.stringify({
          data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] } } } }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input);
    };

    const response = await handleGitHubContributions(request, mockEnv);
    global.fetch = originalFetch;

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('returns JSON content type', async () => {
    const request = new Request('http://localhost/api/github/contributions?username=testuser');

    // Mock fetch to return successful response
    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://api.github.com/graphql') {
        return new Response(JSON.stringify({
          data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] } } } }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input);
    };

    const response = await handleGitHubContributions(request, mockEnv);
    global.fetch = originalFetch;

    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('makes request to GitHub GraphQL API', async () => {
    const request = new Request('http://localhost/api/github/contributions?username=testuser');

    // Mock fetch to intercept GitHub API call
    const originalFetch = global.fetch;
    let githubApiCalled = false;
    let requestHeaders: Record<string, string> = {};
    let requestBody: any = null;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === 'https://api.github.com/graphql') {
        githubApiCalled = true;
        const headers = new Headers(init?.headers);
        requestHeaders = {
          'Authorization': headers.get('Authorization') || '',
          'User-Agent': headers.get('User-Agent') || '',
          'Content-Type': headers.get('Content-Type') || '',
        };
        requestBody = JSON.parse(init?.body as string);

        // Return mock GitHub response
        return new Response(JSON.stringify({
          data: {
            user: {
              contributionsCollection: {
                contributionCalendar: {
                  totalContributions: 100,
                  weeks: [
                    {
                      contributionDays: [
                        { contributionCount: 5, date: '2024-01-01' }
                      ]
                    }
                  ]
                }
              }
            }
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch(input, init);
    };

    const response = await handleGitHubContributions(request, mockEnv);

    // Restore original fetch
    global.fetch = originalFetch;

    expect(githubApiCalled).toBe(true);
    expect(requestHeaders['Authorization']).toBe('Bearer test-github-token');
    expect(requestHeaders['User-Agent']).toBe('hultberg-org-worker');
    expect(requestHeaders['Content-Type']).toBe('application/json');
    expect(requestBody.query).toContain('contributionsCollection');
    expect(requestBody.variables.username).toBe('testuser');

    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.data.user.contributionsCollection.contributionCalendar.totalContributions).toBe(100);
  });

  it('calculates correct date range for last 12 months', async () => {
    const request = new Request('http://localhost/api/github/contributions?username=testuser');

    const originalFetch = global.fetch;
    let requestBody: any = null;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === 'https://api.github.com/graphql') {
        requestBody = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({
          data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] } } } }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input, init);
    };

    await handleGitHubContributions(request, mockEnv);
    global.fetch = originalFetch;

    const fromDate = new Date(requestBody.variables.from);
    const toDate = new Date(requestBody.variables.to);
    const now = new Date();

    // Check that 'to' is approximately now (within 1 minute)
    expect(Math.abs(toDate.getTime() - now.getTime())).toBeLessThan(60000);

    // Check that 'from' is approximately 12 months ago
    const expectedFrom = new Date();
    expectedFrom.setFullYear(expectedFrom.getFullYear() - 1);
    expect(Math.abs(fromDate.getTime() - expectedFrom.getTime())).toBeLessThan(60000);
  });

  it('handles GitHub API errors gracefully', async () => {
    const request = new Request('http://localhost/api/github/contributions?username=testuser');

    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://api.github.com/graphql') {
        return new Response('GitHub API Error', { status: 500 });
      }
      return originalFetch(input);
    };

    const response = await handleGitHubContributions(request, mockEnv);
    global.fetch = originalFetch;

    expect(response.status).toBe(500);
    const body = await response.json() as { error: string; details: string };
    expect(body.error).toBe('Failed to fetch GitHub contributions');
    expect(body.details).toBeDefined();
  });

  it('handles network errors gracefully', async () => {
    const request = new Request('http://localhost/api/github/contributions?username=testuser');

    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://api.github.com/graphql') {
        throw new Error('Network error');
      }
      return originalFetch(input);
    };

    const response = await handleGitHubContributions(request, mockEnv);
    global.fetch = originalFetch;

    expect(response.status).toBe(500);
    const body = await response.json() as { error: string; details: string };
    expect(body.error).toBe('Failed to fetch GitHub contributions');
    expect(body.details).toBe('Network error');
  });

  it('returns proper structure matching GitHub GraphQL response', async () => {
    const request = new Request('http://localhost/api/github/contributions?username=testuser');

    const originalFetch = global.fetch;
    const mockResponse = {
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: 250,
              weeks: [
                {
                  contributionDays: [
                    { contributionCount: 3, date: '2024-01-01' },
                    { contributionCount: 5, date: '2024-01-02' }
                  ]
                }
              ]
            }
          }
        }
      }
    };

    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === 'https://api.github.com/graphql') {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch(input);
    };

    const response = await handleGitHubContributions(request, mockEnv);
    global.fetch = originalFetch;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(mockResponse);
  });
});
