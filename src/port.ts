/**
 * The auth wire contract this client consumes. These are the DTOs and routes the BFF
 * returns; this package DECLARES what it expects (it is the consumer), so it never
 * depends on the server package that owns the contract.
 *
 * BFFs differ in two ways this port absorbs:
 *  - Paths: `AUTH_ROUTES` is only the default; the client takes a per-app override map.
 *  - DTOs: `AuthUser` / `Session` are the default shapes; every flow method is generic at
 *    the call site, so an app types its own response DTOs without this package knowing them.
 *
 * One rule unifies session handling across BFFs: within the auth domain, a top-level string
 * `token` in a response body IS the session token. Whenever a flow response carries one, the
 * client persists it — that single rule covers classic login, register endpoints that already
 * sign you in, reset endpoints that auto-login, and `me` responses that carry a renewed token
 * (sliding session renewal).
 */

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface Session {
  /** Signed JWT to put in `Authorization: Bearer`. */
  token: string;
  userId: string;
  expiresAt: string;
}

/**
 * Canonical BFF routes for the auth domain — the default paths this client calls.
 * Declared here (not imported) so the client states the contract it relies on; apps with
 * a different BFF pass a partial override via `AuthClientConfig.routes`.
 */
export const AUTH_ROUTES = {
  register: "/auth/register",
  login: "/auth/login",
  magicLinkStart: "/auth/magic-link",
  magicLinkConsume: "/auth/magic-link/consume",
  passwordResetStart: "/auth/password-reset",
  passwordResetConsume: "/auth/password-reset/consume",
  /** Current session/user endpoint (GET). May return a renewed `token` (sliding renewal). */
  me: "/auth/me",
} as const;

export type AuthRoute = (typeof AUTH_ROUTES)[keyof typeof AUTH_ROUTES];
export type AuthRoutes = { [K in keyof typeof AUTH_ROUTES]: string };

/**
 * The HTTP capability this client composes, taken as an injected object. `post` drives the
 * flows and `get` drives `me` — declared inline so the package depends on no transport
 * implementation. Wire any client whose methods resolve the parsed JSON body (and reject on
 * HTTP error); the injected client is also responsible for attaching the stored token.
 */
export interface AuthHttp {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
}

/**
 * Where the session token lives on the device. A port so the app can choose the
 * backing store (Expo SecureStore in production, in-memory for tests / plain JS)
 * without the auth client knowing which.
 */
export interface TokenStore {
  /** The stored token, or null if none. */
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * The auth domain on the client: password (register/login), magic link, password reset and
 * the current-session read (`me`) over HTTP to the BFF, persisting the session token in the
 * TokenStore per the top-level-`token` rule above.
 *
 * `verifySession` is intentionally absent — verifying the JWT is the server's job (the
 * BFF does it on protected routes). The client trusts the server: an expired/invalid
 * token surfaces as a 401; wire the http client's `onUnauthorized(code)` to clear the store
 * on session-dead codes.
 */
export interface AuthClient {
  /**
   * Registers. `extra` is spread into the request body for BFFs whose signup takes more
   * than email/password (display name, locale, location…). If the BFF signs the user in
   * right away (its response carries `token`), the session is persisted.
   */
  register<T = AuthUser>(email: string, password: string, extra?: Record<string, unknown>): Promise<T>;
  /** Logs in and persists the session token. */
  login<T = Session>(email: string, password: string): Promise<T>;

  startMagicLink(email: string): Promise<void>;
  /** Consumes a magic-link token and persists the resulting session. */
  consumeMagicLink<T = Session>(token: string): Promise<T>;

  /** Starts a password reset. `extra` is spread into the body (e.g. `{ locale }` for the email). */
  startPasswordReset(email: string, extra?: Record<string, unknown>): Promise<void>;
  /**
   * Consumes a password reset. The body is BFF-specific, so it is passed through as-is —
   * `{ token, newPassword }` for the canonical BFF; e.g. `{ email, code, password }` for a
   * code-based one. If the BFF auto-logs-in (response carries `token`), the session is persisted.
   */
  consumePasswordReset<T = unknown>(input: Record<string, unknown>): Promise<T>;

  /**
   * Reads the current session/user (GET). If the response carries a renewed `token`
   * (sliding renewal), it is persisted before the response is returned.
   */
  me<T = unknown>(): Promise<T>;

  /** Drops the stored token. The JWT is stateless, so there is nothing to revoke server-side. */
  logout(): Promise<void>;
  /** The current stored token, or null. */
  currentToken(): Promise<string | null>;
  /** Whether a token is stored. The server stays authoritative (a stale token 401s on use). */
  isAuthenticated(): Promise<boolean>;
}
