// Browser previews have no Keychain, so the key lives in memory only and is gone on reload.
let saved: string | null = null;

/** The key set during this page load, or null. */
export const loadUsdaKey = async (): Promise<string | null> => saved;
/** Keeps the key in memory for this page load only. */
export const saveUsdaKey = async (key: string): Promise<void> => void (saved = key);
/** Forgets the in-memory key. */
export const deleteUsdaKey = async (): Promise<void> => void (saved = null);
