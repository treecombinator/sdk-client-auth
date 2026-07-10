import { AUTH_ROUTES } from "./port";
import type { AuthClient, AuthHttp, AuthRoutes, AuthUser, Session, TokenStore } from "./port";

/**
 * The auth domain on the client. Compose it with an http client and a token store —
 * the store is shared so the http client can attach the token and drop it on a 401:
 *
 * ```ts
 * const store = createSecureStoreTokenStore({ ... });
 * const http = createHttpClient({
 *   baseUrl,
 *   getToken: () => store.get(), // attach the session on every request
 *   // Clear only when the 401 means a dead session — a failed login is also a 401.
 *   onUnauthorized: (code) => {
 *     if (code !== "invalid_credentials") store.clear();
 *   },
 * });
 * const auth = createAuthClient({ http, store });
 * ```
 *
 * Session persistence follows one rule (see port.ts): any flow response carrying a top-level
 * string `token` has it persisted — login, register-that-signs-in, reset-that-auto-logs-in,
 * magic-link consume, and `me` sliding renewal all fall out of it.
 *
 * A BFF with different paths overrides them per app:
 *
 * ```ts
 * const auth = createAuthClient({
 *   http,
 *   store,
 *   routes: { register: "/auth/signup", passwordResetStart: "/auth/forgot", passwordResetConsume: "/auth/reset" },
 * });
 * ```
 */
export interface AuthClientConfig {
  http: AuthHttp;
  store: TokenStore;
  /** Per-app path overrides, merged over `AUTH_ROUTES`. */
  routes?: Partial<AuthRoutes>;
}

export function createAuthClient(config: AuthClientConfig): AuthClient {
  const { http, store } = config;
  const routes: AuthRoutes = { ...AUTH_ROUTES, ...config.routes };

  /** The one session rule: persist a top-level string `token` when a response carries it. */
  async function persistSession<T>(body: T): Promise<T> {
    const token = (body as { token?: unknown } | null | undefined)?.token;
    if (typeof token === "string" && token) await store.set(token);
    return body;
  }

  return {
    async register<T = AuthUser>(email: string, password: string, extra?: Record<string, unknown>) {
      return persistSession(await http.post<T>(routes.register, { ...extra, email, password }));
    },
    async login<T = Session>(email: string, password: string) {
      return persistSession(await http.post<T>(routes.login, { email, password }));
    },
    startMagicLink(email: string) {
      return http.post<void>(routes.magicLinkStart, { email });
    },
    async consumeMagicLink<T = Session>(token: string) {
      return persistSession(await http.post<T>(routes.magicLinkConsume, { token }));
    },
    startPasswordReset(email: string, extra?: Record<string, unknown>) {
      return http.post<void>(routes.passwordResetStart, { ...extra, email });
    },
    async consumePasswordReset<T = unknown>(input: Record<string, unknown>) {
      return persistSession(await http.post<T>(routes.passwordResetConsume, input));
    },
    async me<T = unknown>() {
      return persistSession(await http.get<T>(routes.me));
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
export type { AuthClient, AuthHttp, AuthRoute, AuthRoutes, AuthUser, Session, TokenStore } from "./port";
export { createMemoryTokenStore } from "./adapters/memory";
export { createSecureStoreTokenStore, type SecureStoreDeps } from "./adapters/secure-store";
export { createSocialLogin } from "./social";
export type {
  SocialAuthorizer,
  SocialCredential,
  SocialHttp,
  SocialLogin,
  SocialLoginConfig,
  SocialLoginInput,
  SocialProvider,
} from "./social";
