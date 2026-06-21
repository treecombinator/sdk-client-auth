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
 *     requireAuthentication: true,                                    // biometric / passcode gate
 *   }),
 *   setItem: (k, v) => SecureStore.setItemAsync(k, v, {
 *     keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
 *     requireAuthentication: true,
 *   }),
 *   deleteItem: (k) => SecureStore.deleteItemAsync(k),
 * });
 * ```
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
