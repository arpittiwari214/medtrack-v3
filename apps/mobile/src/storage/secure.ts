/**
 * Token storage in the OS keychain.
 *
 * Deliberately separate from the AsyncStorage cache: AsyncStorage is plain,
 * unencrypted files, which is fine for a list of medicine names on a device the
 * user controls but wrong for credentials. `expo-secure-store` puts these in
 * the iOS Keychain and Android Keystore, so they are protected by the device
 * lock and are not readable from a filesystem backup.
 */

import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'mt_access_token';
const REFRESH_KEY = 'mt_refresh_token';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Readable only while the device is unlocked, and never restored to a
  // different device from a backup.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY, OPTIONS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY, OPTIONS);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken, OPTIONS),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken, OPTIONS),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY, OPTIONS),
    SecureStore.deleteItemAsync(REFRESH_KEY, OPTIONS),
  ]);
}
