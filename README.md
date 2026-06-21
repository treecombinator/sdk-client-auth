# @treecombinator/sdk-client-auth

---

> Developed by Danthur Lice.\
> Copyright © 2026 Tree Combinator.\
> Contact: dev (at) treecombinator.com

---

The **client auth** domain of the Tree Combinator SDK — the email/password, magic-link and
password-reset flows on the client (React Native / Expo / browser), driven over HTTP to your
BFF and persisting the session token on the device. It composes an injected HTTP client and a
token store, so it depends on no transport and no platform storage; it ships an in-memory store
and an Expo SecureStore adapter, with zero runtime dependencies.

## Install

```bash
npm install github:treecombinator/sdk-client-auth
```

## Use

```ts
import { createAuthClient, createSecureStoreTokenStore } from "@treecombinator/sdk-client-auth";
import * as SecureStore from "expo-secure-store";

const store = createSecureStoreTokenStore({
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
  deleteItem: (k) => SecureStore.deleteItemAsync(k),
});

// Wire any HTTP client whose `post(path, body)` resolves the parsed JSON (rejects on error).
// Share the store so it attaches the token and clears it on a 401.
const http = createHttpClient({
  baseUrl: "https://api.example.com",
  getToken: () => store.get(),
  onUnauthorized: () => store.clear(),
});

const auth = createAuthClient({ http, store });

const user = await auth.register("a@b.com", "pw");
const session = await auth.login("a@b.com", "pw"); // { token, userId, expiresAt }; token is persisted
```

`createAuthClient({ http, store })` returns the auth client:

- `register(email, password)` / `login(email, password)` — password auth; `login` persists the session token.
- `startMagicLink(email)` / `consumeMagicLink(token)` — passwordless login; `consumeMagicLink` persists the token.
- `startPasswordReset(email)` / `consumePasswordReset(token, newPassword)` — reset flow.
- `logout()` — drops the stored token. `currentToken()` / `isAuthenticated()` — read the stored session.

Token stores: `createMemoryTokenStore()` (tests / plain JS) and `createSecureStoreTokenStore(deps)`
(hardware-backed via injected Expo SecureStore functions). The package also exports the auth wire
contract it consumes (`AuthUser`, `Session`, `AUTH_ROUTES`, `AuthRoute`) and the `AuthHttp` / `TokenStore` shapes.

## Notes

- The HTTP client is injected via a minimal `AuthHttp` shape (`post<T>(path, body?) => Promise<T>`) — this
  package owns no transport. Wire your own typed client; its `post` should resolve the parsed body and reject on HTTP error.
- `verifySession` is intentionally absent — verifying the JWT is the server's job. A stale token surfaces as a
  401, which the http client turns into a clear of the store; the server stays authoritative.
- The session token is persisted by `login` / `consumeMagicLink` and cleared by `logout`. For real sessions use
  `createSecureStoreTokenStore`; the in-memory store loses the token when the process ends.
