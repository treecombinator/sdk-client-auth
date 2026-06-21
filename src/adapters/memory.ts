import type { TokenStore } from "../port";

/**
 * In-memory TokenStore. The token is lost when the process ends — for tests, plain JS,
 * or as a fallback when no secure storage is available. NOT for persisting a real session.
 */
export function createMemoryTokenStore(): TokenStore {
  let token: string | null = null;
  return {
    async get() {
      return token;
    },
    async set(value) {
      token = value;
    },
    async clear() {
      token = null;
    },
  };
}
