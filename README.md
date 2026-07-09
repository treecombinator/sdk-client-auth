# @treecombinator/sdk-client-auth

---

> Developed by Danthur Lice.\
> Copyright © 2026 Tree Combinator.\
> Contact: dev (at) treecombinator.com

---

The **client auth** domain of the Tree Combinator SDK — the email/password, magic-link,
password-reset and current-session (`me`) flows on the client (React Native / Expo / browser),
driven over HTTP to your BFF and persisting the session token on the device. It composes an
injected HTTP client and a token store, so it depends on no transport and no platform storage;
it ships an in-memory store and an Expo SecureStore adapter, with zero runtime dependencies.

## Install

```bash
givo add @treecombinator/sdk-client-auth
```

## Use

```ts
import { createAuthClient, createSecureStoreTokenStore } from "@treecombinator/sdk-client-auth";
import { createHttpClient } from "@treecombinator/sdk-client-http";
import * as SecureStore from "expo-secure-store";

const store = createSecureStoreTokenStore({
  getItem: (k) => SecureStore.getItemAsync(k, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, // no iCloud sync, device-only
  }),
  setItem: (k, v) => SecureStore.setItemAsync(k, v, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }),
  deleteItem: (k) => SecureStore.deleteItemAsync(k),
});

// Wire any HTTP client whose `get(path)` / `post(path, body)` resolve the parsed JSON (reject on
// error) — `@treecombinator/sdk-client-http` is the SDK's own. Share the store so it attaches the
// token, and clear it only when the 401 means a dead session (a failed login is also a 401).
const http = createHttpClient({
  baseUrl: "https://api.example.com",
  getToken: () => store.get(),
  onUnauthorized: (code) => {
    if (code !== "invalid_credentials") store.clear();
  },
});

const auth = createAuthClient({ http, store });

const user = await auth.register("a@b.com", "pw");
const session = await auth.login("a@b.com", "pw"); // { token, userId, expiresAt }; token is persisted
```

`createAuthClient({ http, store, routes? })` returns the auth client:

- `register(email, password, extra?)` / `login(email, password)` — password auth; `extra` is spread into
  the body for BFFs whose signup takes more than email/password (display name, locale, location…).
- `startMagicLink(email)` / `consumeMagicLink(token)` — passwordless login.
- `startPasswordReset(email, extra?)` / `consumePasswordReset(input)` — reset flow; `extra` is spread into
  the body (e.g. `{ locale }` for the email). `input` is passed through as-is because the consume body is
  BFF-specific — `{ token, newPassword }` for the canonical BFF, `{ email, code, password }` for a code-based one.
- `me()` — GET of the current session/user.
- `logout()` — drops the stored token. `currentToken()` / `isAuthenticated()` — read the stored session.

Session persistence follows one rule: any flow response carrying a top-level string `token` has it
persisted to the store — that single rule covers login, register endpoints that already sign you in,
reset endpoints that auto-login, magic-link consume, and `me` responses carrying a renewed token
(sliding session renewal).

Every flow method is generic at the call site (`register<T = AuthUser>`, `login<T = Session>`,
`consumeMagicLink<T = Session>`, `consumePasswordReset<T = unknown>`, `me<T = unknown>`), so an app
types its own response DTOs. A BFF with different paths overrides them per app — `routes` is a
`Partial<AuthRoutes>` merged over `AUTH_ROUTES`:

```ts
const auth = createAuthClient({
  http,
  store,
  routes: { register: "/auth/signup", passwordResetStart: "/auth/forgot", passwordResetConsume: "/auth/reset" },
});
```

Token stores: `createMemoryTokenStore()` (tests / plain JS) and `createSecureStoreTokenStore(deps)`
(hardware-backed via injected Expo SecureStore functions). The package also exports the auth wire
contract it consumes (`AuthUser`, `Session`, `AUTH_ROUTES`, `AuthRoute`, `AuthRoutes`) and the
`AuthHttp` / `TokenStore` shapes.

## Notes

- The HTTP client is injected via a minimal `AuthHttp` shape (`get<T>(path)` and `post<T>(path, body?)`,
  both `=> Promise<T>`) — this package owns no transport. Wire your own typed client; its methods should
  resolve the parsed body and reject on HTTP error.
- `verifySession` is intentionally absent — verifying the JWT is the server's job. A stale token surfaces as a
  401 — wire the http client's `onUnauthorized(code)` to clear the store on session-dead codes (not on
  `invalid_credentials`, which is a failed login, not a dead session); the server stays authoritative.
- The session token is persisted per the top-level-`token` rule above and cleared by `logout`. For real sessions
  use `createSecureStoreTokenStore`; the in-memory store loses the token when the process ends.
