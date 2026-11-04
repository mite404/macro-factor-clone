import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, Card, Label, palettes, Phone, Row } from '../../ui';
import { localDay } from '../diary/diary';
import { exportBackup, parseBackup, restoreBackup, summarize, type Backup, type BackupSummary } from './backup';
import { pickBackup, shareBackup } from './files';

// A picked file is only ever written after the user confirms it on the `confirm` view.
type Screen =
  | { kind: 'menu' }
  | { kind: 'confirm'; backup: Backup; incoming: BackupSummary; current: BackupSummary };
type Status = { text: string; error: boolean } | null;

const unchanged = 'Your data was not changed.';
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function describe(s: BackupSummary): string {
  const foods = count(s.foods, 'saved food', 'saved foods') + (s.archivedFoods ? ` (${s.archivedFoods} archived)` : '');
  const days = s.days === 0 ? '' : s.days === 1 ? ` on ${s.firstDay}` : ` on ${s.days} days, ${s.firstDay} to ${s.lastDay}`;
  const targets = s.targets ? `, plus ${count(s.targets, 'daily target', 'daily targets')}` : '';
  return `${foods} and ${count(s.entries, 'diary entry', 'diary entries')}${days}${targets}`;
}

function StatusLine({ status }: { status: Status }) {
  const p = palettes.light;
  if (!status) return null;
  return <Label accessibilityRole={status.error ? 'alert' : undefined} accessibilityLiveRegion="polite" size={13}
    style={status.error ? { color: p.danger } : undefined}>{status.text}</Label>;
}

/** Settings: export every record to a JSON file, or replace all data from one after confirmation. */
export default function BackupSettings({ onClose }: { onClose: () => void }) {
  const db = useSQLiteContext();
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [status, setStatus] = useState<Status>(null);
  // Synchronous lock: a second tap can land before React re-renders after the first.
  const busy = useRef(false);
  // While a restore's transaction is open, nothing may navigate away or write to the database.
  const [restoring, setRestoring] = useState(false);
  const p = palettes.light;

  async function run(action: () => Promise<void>, failure: string) {
    if (busy.current) return;
    busy.current = true;
    setStatus(null);
    try {
      await action();
    } catch {
      setStatus({ text: failure, error: true });
    } finally {
      busy.current = false;
    }
  }

  const exportFile = () => run(async () => {
    const backup = await exportBackup(db);
    await shareBackup(`nutrition-diary-${localDay()}.json`, JSON.stringify(backup, null, 2));
  }, `Could not export a backup. ${unchanged}`);

  const chooseFile = () => run(async () => {
    const picked = await pickBackup();
    if (!picked) return;
    const parsed = 'error' in picked ? picked : parseBackup(picked.text);
    if ('error' in parsed) return setStatus({ text: `Not restored. ${parsed.error} ${unchanged}`, error: true });
    const current = summarize(await exportBackup(db));
    setScreen({ kind: 'confirm', backup: parsed.backup, incoming: summarize(parsed.backup), current });
  }, `Could not read that file. ${unchanged}`);

  if (screen.kind === 'confirm') {
    const { backup, incoming, current } = screen;
    const cancel = () => {
      if (busy.current) return;
      setScreen({ kind: 'menu' });
      setStatus({ text: `Restore cancelled. ${unchanged}`, error: false });
    };
    const replace = () => run(async () => {
      setRestoring(true);
      try {
        await restoreBackup(db, backup);
        setScreen({ kind: 'menu' });
        setStatus({ text: `Restored ${describe(incoming)}.`, error: false });
      } finally {
        setRestoring(false);
      }
    }, `Restore failed, so nothing was replaced. ${unchanged}`);
    return <Phone title="Restore backup" onBack={restoring ? undefined : cancel} backLabel="Cancel restore"
      footer={<Row style={{ justifyContent: 'flex-end', padding: 18, gap: 8, backgroundColor: p.surface }}>
        <Button disabled={restoring} onPress={cancel}>Cancel</Button>
        <Button danger disabled={restoring} onPress={replace}>{restoring ? 'Restoring…' : 'Replace all data'}</Button>
      </Row>}>
      <View style={{ padding: 18, gap: 16 }}>
        <Card style={{ gap: 6 }}>
          <Label weight="600">This backup holds</Label>
          <Label>{describe(incoming)}.</Label>
          <Label size={12} muted>Exported {new Date(backup.exportedAt).toLocaleString()}</Label>
        </Card>
        <Card style={{ gap: 6, borderWidth: 1, borderColor: p.danger }}>
          <Label weight="600" style={{ color: p.danger }}>Everything in this app will be replaced</Label>
          {current.foods + current.entries + current.targets === 0
            ? <Label>This app has no saved foods, diary entries, or targets yet, so nothing will be lost.</Label>
            : <>
              <Label>Your current {describe(current)} will be deleted, not merged. This cannot be undone.</Label>
              <Label size={12} muted>If you might need them, cancel and export a backup first.</Label>
            </>}
        </Card>
        {restoring ? <Row style={{ gap: 10 }}>
          <ActivityIndicator color={p.text} />
          <Label accessibilityLiveRegion="polite" style={{ flex: 1 }}>
            Restoring your backup. Keep the app open until it finishes.
          </Label>
        </Row> : <StatusLine status={status} />}
      </View>
    </Phone>;
  }

  return <Phone title="Settings" onBack={onClose} backLabel="Back to food log">
    <View style={{ padding: 18, gap: 16 }}>
      <Label accessibilityRole="header" size={21} weight="600">Backup</Label>
      <Card>
        <Label weight="600">Export a backup</Label>
        <Label size={13} muted>
          Saves every food, including archived ones, every diary entry, and your daily targets to a JSON file you
          choose where to keep, such as Files. The file is not encrypted, so keep it somewhere private.
        </Label>
        <Button primary onPress={exportFile}>Export backup</Button>
      </Card>
      <Card>
        <Label weight="600">Restore from a backup</Label>
        <Label size={13} muted>
          Replaces all foods, diary entries, and targets in this app with a backup file's. You'll see what the file
          holds before anything changes.
        </Label>
        <Button onPress={chooseFile}>Choose backup file</Button>
      </Card>
      <StatusLine status={status} />
      <Label size={12} muted>
        Your diary lives only on this phone. Deleting the app deletes it, and backups are not cloud sync. Export before
        uninstalling or changing phones.
      </Label>
    </View>
  </Phone>;
}
