# AGENTS.md — @treecombinator/sdk-client-auth

> Guide for AI agents. Client auth (authentication) domain of the Tree Combinator SDK for React
> Native / Expo / browser: email/password, magic-link, password-reset and current-session (`me`)
> flows over HTTP, with a device token store. Composes an injected HTTP client and a token store —
> no transport, no platform-storage dependency.

## Use

```ts
import { createAuthClient, createSecureStoreTokenStore } from "@treecombinator/sdk-client-auth";

const store = createSecureStoreTokenStore({ getItem, setItem, deleteItem }); // inject Expo SecureStore
const auth = createAuthClient({ http, store }); // http: any client with get<T>(path) / post<T>(path, body?) => Promise<T>
const session = await auth.login(email, password); // persists session.token in the store
```

`createAuthClient({ http, store, routes? })` → `register(email, password, extra?)`, `login`,
`startMagicLink`/`consumeMagicLink`, `startPasswordReset(email, extra?)`/`consumePasswordReset(input)`,
`me`, `logout`, `currentToken`, `isAuthenticated`. Stores: `createMemoryTokenStore()`,
`createSecureStoreTokenStore(deps)`.

## Notes

- The HTTP client is INJECTED via the minimal `AuthHttp` shape (`get<T>(path)` / `post<T>(path, body?)`
  `=> Promise<T>`); this package imports no transport. The auth wire shapes it consumes (`AuthUser`,
  `Session`, `AUTH_ROUTES`, `AuthRoute`, `AuthRoutes`) are DECLARED locally — it states the contract it
  expects, never importing from the server.
- `routes?: Partial<AuthRoutes>` overrides paths per app, merged over `AUTH_ROUTES` — e.g.
  `routes: { register: "/auth/signup", passwordResetStart: "/auth/forgot", passwordResetConsume: "/auth/reset" }`.
- Flow methods are generic at the call site (`register<T = AuthUser>`, `login`/`consumeMagicLink<T = Session>`,
  `consumePasswordReset`/`me<T = unknown>`). `extra?` is spread into the body (signup display name, locale…);
  `consumePasswordReset(input)` passes the body through as-is (BFF-specific: `{ token, newPassword }` canonical,
  `{ email, code, password }` code-based).
- ONE session rule: any flow response carrying a top-level string `token` gets it persisted — login,
  register-that-signs-in, reset-that-auto-logs-in, magic-link consume, `me` sliding renewal. `logout` clears it.
- `verifySession` is absent by design — the BFF verifies the JWT. A stale token 401s; the http client clears the store.
- Zero runtime dependencies — the package never throws its own errors (failures come from the injected http client).

## Social login

`createSocialLogin({ http, store, authorizers, routes? })` is part of THIS package since 0.1.0 (the old @treecombinator/sdk-client-social is deprecated). Authorizers are injected — never import expo packages here. The session lands via the same `store` used by `createAuthClient`; do not add a second persistence path.
