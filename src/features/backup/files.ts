// iOS/Android file I/O for backups. files.web.ts is the browser counterpart.
import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import { MAX_BACKUP_BYTES, TOO_LARGE } from './backup.ts';

export type Picked = { text: string } | { error: string } | null;

/**
 * Writes the backup to the app cache and opens the share sheet (Save to Files, AirDrop, ...).
 * The cache copy is deleted once the sheet closes, whether the user saved it or cancelled.
 */
export async function shareBackup(name: string, json: string): Promise<void> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  try {
    await file.write(json);
    await shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export backup' });
  } finally {
    file.delete();
  }
}

/**
 * Lets the user choose a JSON file in Files and reads it, refusing oversized files unread.
 * @returns null when the user cancels the picker.
 */
export async function pickBackup(): Promise<Picked> {
  const result = await getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  try {
    if ((file.size ?? 0) > MAX_BACKUP_BYTES) return { error: TOO_LARGE };
    return { text: await file.text() };
  } finally {
    file.delete();
  }
}
