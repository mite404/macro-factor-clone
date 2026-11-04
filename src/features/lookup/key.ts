// The owner's USDA key lives in the iOS Keychain through SecureStore: never SQLite, backups, or logs.
import * as SecureStore from 'expo-secure-store';

const NAME = 'usda-api-key';

/** The saved key, or null when the owner has not added one. */
export const loadUsdaKey = (): Promise<string | null> => SecureStore.getItemAsync(NAME);
/** Replaces the saved key. @throws If the Keychain refuses the write. */
export const saveUsdaKey = (key: string): Promise<void> => SecureStore.setItemAsync(NAME, key);
/** Forgets the saved key. Saved foods stay. */
export const deleteUsdaKey = (): Promise<void> => SecureStore.deleteItemAsync(NAME);
