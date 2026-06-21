# AGENTS.md — @treecombinator/sdk-client-auth

> Guide for AI agents. Client auth (authentication) domain of the Tree Combinator SDK for React
> Native / Expo / browser: email/password, magic-link and password-reset flows over HTTP, with a
> device token store. Composes an injected HTTP client and a token store — no transport, no
> platform-storage dependency.

## Use

```ts
import { createAuthClient, createSecureStoreTokenStore } from "@treecombinator/sdk-client-auth";

const store = createSecureStoreTokenStore({ getItem, setItem, deleteItem }); // inject Expo SecureStore
const auth = createAuthClient({ http, store }); // http: any client with post<T>(path, body?) => Promise<T>
const session = await auth.login(email, password); // persists session.token in the store
```

`createAuthClient({ http, store })` → `register`, `login`, `startMagicLink`/`consumeMagicLink`,
`startPasswordReset`/`consumePasswordReset`, `logout`, `currentToken`, `isAuthenticated`. Stores:
`createMemoryTokenStore()`, `createSecureStoreTokenStore(deps)`.

## Notes

- The HTTP client is INJECTED via the minimal `AuthHttp` shape (`post<T>(path, body?) => Promise<T>`);
  this package imports no transport. The auth wire shapes it consumes (`AuthUser`, `Session`, `AUTH_ROUTES`,
  `AuthRoute`) are DECLARED locally — it states the contract it expects, never importing from the server.
- `verifySession` is absent by design — the BFF verifies the JWT. A stale token 401s; the http client clears the store.
- `login` / `consumeMagicLink` persist the token, `logout` clears it. Zero runtime dependencies — the package never throws its own errors (failures come from the injected http client).
