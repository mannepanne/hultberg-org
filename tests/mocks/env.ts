// ABOUT: Mock Env for testing
// ABOUT: Provides test environment configuration

import { Env } from '@/types';
import { createMockKV } from './kvNamespace';

/**
 * Creates a mock Env object for testing
 * Provides default test values for all environment variables
 * Can be overridden with custom values via the overrides parameter
 */
export function createMockEnv(overrides?: Partial<Env>): Env {
  return {
    ADMIN_EMAIL: 'test@example.com',
    JWT_SECRET: 'test-secret-key',
    RESEND_API_KEY: 'test-resend-key',
    GITHUB_TOKEN: 'test-github-token',
    AUTH_KV: createMockKV(),
    RATE_LIMIT_KV: createMockKV(),
    ...overrides,
  };
}
