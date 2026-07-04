import type { TokenStore } from "../port";

/**
 * Hardware-backed TokenStore via Expo SecureStore (iOS Keychain / Android Keystore).
 * The SecureStore functions are injected so this package never depends on expo-secure-store
 * and stays RN-agnostic — the app wires them.
 *
 * Recommended wiring for a session token (the app supplies the options, because it owns
 * the expo-secure-store import):
 *
 * ```ts
 * import * as SecureStore from "expo-secure-store";
 * const store = createSecureStoreTokenStore({
 *   getItem: (k) => SecureStore.getItemAsync(k, {
 *     keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, // no iCloud sync, device-only
 *   }),
 *   setItem: (k, v) => SecureStore.setItemAsync(k, v, {
 *     keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
 *   }),
 *   deleteItem: (k) => SecureStore.deleteItemAsync(k),
 * });
 * ```
 *
 * Leave `requireAuthentication` OFF for a session token: it is read on every request, so a
 * biometric gate would prompt Face ID/fingerprint per request (and it throws on Android devices
 * with no screen lock). Reserve that option for rarely-read secrets — and if you do use it,
 * put an in-memory cache in front so reads don't hit the keychain each time.
 *
 * On Android, also exclude this key from Auto Backup (a restored value can't be decrypted).
 */
export interface SecureStoreDeps {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
  /** Storage key. Default "tc.auth.token". */
  key?: string;
}

export function createSecureStoreTokenStore(deps: SecureStoreDeps): TokenStore {
  const key = deps.key ?? "tc.auth.token";
  return {
    get: () => deps.getItem(key),
    set: (value) => deps.setItem(key, value),
    clear: () => deps.deleteItem(key),
  };
}
