/**
 * The auth wire contract this client consumes. These are the DTOs and routes the BFF
 * returns; this package DECLARES what it expects (it is the consumer), so it never
 * depends on the server package that owns the contract.
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
 * Canonical BFF routes for the auth domain — the exact paths this client POSTs to.
 * Declared here (not imported) so the client states the contract it relies on.
 */
export const AUTH_ROUTES = {
  register: "/auth/register",
  login: "/auth/login",
  magicLinkStart: "/auth/magic-link",
  magicLinkConsume: "/auth/magic-link/consume",
  passwordResetStart: "/auth/password-reset",
  passwordResetConsume: "/auth/password-reset/consume",
} as const;

export type AuthRoute = (typeof AUTH_ROUTES)[keyof typeof AUTH_ROUTES];

/**
 * The HTTP capability this client composes, taken as an injected object. Only `post`
 * is needed — declared inline so the package depends on no transport implementation.
 * Wire any client whose `post` resolves the parsed JSON body (and rejects on HTTP error).
 */
export interface AuthHttp {
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
 * The auth domain on the client: password (register/login), magic link and
 * password reset over HTTP to the BFF, persisting the session token in the TokenStore.
 *
 * `verifySession` is intentionally absent — verifying the JWT is the server's job (the
 * BFF does it on protected routes). The client trusts the server: an expired/invalid
 * token surfaces as a 401, which the http client turns into a clear of the store.
 */
export interface AuthClient {
  register(email: string, password: string): Promise<AuthUser>;
  /** Logs in and persists the session token. */
  login(email: string, password: string): Promise<Session>;

  startMagicLink(email: string): Promise<void>;
  /** Consumes a magic-link token and persists the resulting session. */
  consumeMagicLink(token: string): Promise<Session>;

  startPasswordReset(email: string): Promise<void>;
  consumePasswordReset(token: string, newPassword: string): Promise<void>;

  /** Drops the stored token. The JWT is stateless, so there is nothing to revoke server-side. */
  logout(): Promise<void>;
  /** The current stored token, or null. */
  currentToken(): Promise<string | null>;
  /** Whether a token is stored. The server stays authoritative (a stale token 401s on use). */
  isAuthenticated(): Promise<boolean>;
}
