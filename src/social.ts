/**
 * Social login — the same auth domain, a different way in. The app injects one
 * authorizer per provider (wrapping expo-auth-session for Google, expo-apple-
 * authentication for Apple); this module runs the chosen flow, exchanges the
 * credential at the BFF (which verifies it — client secrets never leave it) and
 * persists the session token in the SAME store the rest of the auth domain reads.
 *
 * History: this lived in @treecombinator/sdk-client-social until 0.1.0. Merged
 * here because "social" is not a domain — signing in is; the split only bred
 * naming confusion.
 */
import { TcError } from "@treecombinator/sdk-common";

import type { Session, TokenStore } from "./port";

/** Social identity providers this domain supports. */
export type SocialProvider = "google" | "apple";

/**
 * What the client POSTs to the BFF's social route. The credential takes one of two
 * shapes, both verified server-side:
 *  - `code` (+ `codeVerifier`, `redirectUri`): OAuth authorization code from a
 *    browser/PKCE flow — typically Google via expo-auth-session.
 *  - `idToken` (+ `nonce`): an OpenID id_token from a native flow — Apple via
 *    expo-apple-authentication, or Google via the native sign-in SDK.
 */
export interface SocialLoginInput {
  provider: SocialProvider;
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
  idToken?: string;
  nonce?: string;
  /**
   * Profile hint some providers only reveal on the device: Apple hands the user's
   * name to the CLIENT once, on first authorization — the id_token never carries
   * it — so the BFF can only learn it if the authorizer forwards it here.
   */
  name?: string;
}

/** The credential an authorizer produces — everything in the BFF request except `provider`. */
export type SocialCredential = Omit<SocialLoginInput, "provider">;

/**
 * Runs one provider's device-side interaction and returns the credential to hand to
 * the BFF. Injected by the app so this package never depends on expo packages.
 */
export type SocialAuthorizer = () => Promise<SocialCredential>;

/** The default BFF route (single route, `provider` field disambiguates). */
const SOCIAL_ROUTE = "/auth/social";

/** The transport this module needs, structurally. */
export interface SocialHttp {
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
}

export interface SocialLoginConfig {
  http: SocialHttp;
  /** Where the session token lands — pass the SAME store the auth client uses. */
  store: Pick<TokenStore, "set">;
  /** One authorizer per provider the app offers. A provider with no authorizer can't be used. */
  authorizers: Partial<Record<SocialProvider, SocialAuthorizer>>;
  /** Per-provider path overrides; a provider absent here uses the canonical single route. */
  routes?: Partial<Record<SocialProvider, string>>;
}

export interface SocialLogin {
  /** Authenticate with a provider; persists the session token on success. */
  login<T extends { token: string } = Session>(provider: SocialProvider): Promise<T>;
}

export function createSocialLogin(config: SocialLoginConfig): SocialLogin {
  const { http, store, authorizers } = config;
  return {
    async login<T extends { token: string } = Session>(provider: SocialProvider) {
      const authorize = authorizers[provider];
      if (!authorize) {
        throw new TcError("social_provider_unconfigured", `no authorizer configured for "${provider}"`);
      }
      const credential = await authorize();
      const route = config.routes?.[provider] ?? SOCIAL_ROUTE;
      const session = await http.post<T>(route, { ...credential, provider });
      if (typeof session?.token !== "string" || !session.token) {
        throw new TcError("social_session_invalid", "BFF response carries no session token");
      }
      await store.set(session.token);
      return session;
    },
  };
}
