import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * SECURITY (M1): `token` and `refreshToken` are stored in the device keychain
 * (expo-secure-store, encrypted at rest) instead of plain AsyncStorage.
 * Non-sensitive identity fields (role, name, ...) stay in AsyncStorage.
 *
 * Drop-in replacements for the AsyncStorage calls used across the app.
 */

const SECURE_KEYS: readonly string[] = ['token', 'refreshToken'];

function isSecure(key: string): boolean {
  return SECURE_KEYS.includes(key);
}

export async function getItem(key: string): Promise<string | null> {
  if (isSecure(key)) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      // SecureStore is unavailable on web — fall back so dev previews still work.
      console.warn(`SecureStore read failed for '${key}', falling back to AsyncStorage`);
      return AsyncStorage.getItem(key);
    }
  }
  return AsyncStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isSecure(key)) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (e) {
      console.warn(`SecureStore write failed for '${key}', falling back to AsyncStorage`);
    }
  }
  await AsyncStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (isSecure(key)) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore — key may not exist or platform unsupported
    }
    // Also clear any legacy AsyncStorage copy from before the SecureStore migration.
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

export async function multiSet(pairs: [string, string][]): Promise<void> {
  const securePairs = pairs.filter(([k]) => isSecure(k));
  const plainPairs = pairs.filter(([k]) => !isSecure(k));
  await Promise.all([
    ...securePairs.map(([k, v]) => setItem(k, v)),
    plainPairs.length > 0 ? AsyncStorage.multiSet(plainPairs) : Promise.resolve(),
  ]);
}

export async function multiRemove(keys: string[]): Promise<void> {
  const secureKeys = keys.filter(isSecure);
  const plainKeys = keys.filter((k) => !isSecure(k));
  await Promise.all([
    ...secureKeys.map(removeItem),
    plainKeys.length > 0 ? AsyncStorage.multiRemove(plainKeys) : Promise.resolve(),
  ]);
}
