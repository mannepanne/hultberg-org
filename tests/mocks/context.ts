// ABOUT: Mock ExecutionContext for testing
// ABOUT: Provides test implementation of Cloudflare Workers ExecutionContext

/**
 * Creates a mock ExecutionContext for testing
 * Implements the required methods with no-op implementations
 */
export function createMockContext(): ExecutionContext {
  return {
    waitUntil: (promise: Promise<any>) => {
      // No-op in tests
    },
    passThroughOnException: () => {
      // No-op in tests
    },
    props: {},
  };
}
