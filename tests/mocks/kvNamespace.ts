// ABOUT: Mock KVNamespace for testing
// ABOUT: Provides in-memory implementation of Cloudflare KV operations

/**
 * Creates a mock KVNamespace for testing
 * Uses an in-memory Map to simulate KV storage
 */
export function createMockKV(): KVNamespace {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string, options?: any) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async (options?: any) => ({
      keys: Array.from(store.keys()).map(name => ({ name })),
      list_complete: true,
      cursor: '',
    }),
  } as unknown as KVNamespace;
}
