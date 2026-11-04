// Browser file I/O for backups, used by the web build and Storybook. files.ts is the native version.
import { getDocumentAsync } from 'expo-document-picker';

import { MAX_BACKUP_BYTES, TOO_LARGE } from './backup.ts';
import type { Picked } from './files.ts';

/** Downloads the backup as a file. */
export async function shareBackup(name: string, json: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Lets the user choose a JSON file and reads it, refusing oversized files unread.
 * @returns null when the user cancels the picker.
 */
export async function pickBackup(): Promise<Picked> {
  const result = await getDocumentAsync({ type: 'application/json', base64: false });
  if (result.canceled) return null;
  const file = result.assets[0].file!;
  if (file.size > MAX_BACKUP_BYTES) return { error: TOO_LARGE };
  return { text: await file.text() };
}
