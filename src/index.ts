import { AUTH_ROUTES } from "./port";
import type { AuthClient, AuthHttp, AuthUser, Session, TokenStore } from "./port";

/**
 * The auth domain on the client. Compose it with an http client and a token store —
 * the store is shared so the http client can attach the token and drop it on a 401:
 *
 * ```ts
 * const store = createSecureStoreTokenStore({ ... });
 * const http = createHttpClient({
 *   baseUrl,
 *   getToken: () => store.get(),         // attach the session on every request
 *   onUnauthorized: () => store.clear(), // a 401 means the session is dead — drop it
 * });
 * const auth = createAuthClient({ http, store });
 * ```
 *
 * `login` and `consumeMagicLink` persist the token; `logout` clears it.
 */
export interface AuthClientConfig {
  http: AuthHttp;
  store: TokenStore;
}

export function createAuthClient(config: AuthClientConfig): AuthClient {
  const { http, store } = config;
  return {
    register(email, password) {
      return http.post<AuthUser>(AUTH_ROUTES.register, { email, password });
    },
    async login(email, password) {
      const session = await http.post<Session>(AUTH_ROUTES.login, { email, password });
      await store.set(session.token);
      return session;
    },
    startMagicLink(email) {
      return http.post<void>(AUTH_ROUTES.magicLinkStart, { email });
    },
    async consumeMagicLink(token) {
      const session = await http.post<Session>(AUTH_ROUTES.magicLinkConsume, { token });
      await store.set(session.token);
      return session;
    },
    startPasswordReset(email) {
      return http.post<void>(AUTH_ROUTES.passwordResetStart, { email });
    },
    consumePasswordReset(token, newPassword) {
      return http.post<void>(AUTH_ROUTES.passwordResetConsume, { token, newPassword });
    },
    async logout() {
      await store.clear();
    },
    currentToken() {
      return store.get();
    },
    async isAuthenticated() {
      return (await store.get()) !== null;
    },
  };
}

export { AUTH_ROUTES } from "./port";
export type { AuthClient, AuthHttp, AuthRoute, AuthUser, Session, TokenStore } from "./port";
export { createMemoryTokenStore } from "./adapters/memory";
export { createSecureStoreTokenStore, type SecureStoreDeps } from "./adapters/secure-store";
