import { useEffect, useState } from 'react';

import { Button, Card, Field, Label, palettes, Row } from '../../ui';
import { deleteUsdaKey, loadUsdaKey, saveUsdaKey } from './key';
import { parseUsdaKey } from './lookup';

type Status = { text: string; error: boolean } | null;

/** Settings card for the owner's own USDA key. The key is masked, never shown back, and never exported. */
export function UsdaKeySettings() {
  const p = palettes.light;
  const [saved, setSaved] = useState<boolean | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<Status>(null);
  useEffect(() => {
    loadUsdaKey().then(key => setSaved(key !== null), () => setSaved(false));
  }, []);

  async function save() {
    const parsed = parseUsdaKey(draft);
    if ('error' in parsed) return setStatus({ text: parsed.error, error: true });
    try {
      await saveUsdaKey(parsed.key);
      setSaved(true);
      setDraft('');
      setStatus({ text: 'Key saved. Barcode lookup can now ask USDA.', error: false });
    } catch {
      setStatus({ text: "Couldn't save the key. Try again.", error: true });
    }
  }

  async function remove() {
    try {
      await deleteUsdaKey();
      setSaved(false);
      setStatus({ text: 'Key removed. Barcode lookup still finds your saved foods.', error: false });
    } catch {
      setStatus({ text: "Couldn't remove the key. Try again.", error: true });
    }
  }

  return <Card>
    <Label weight="600">{saved ? 'Your USDA key is saved' : 'Add your USDA key'}</Label>
    <Label size={13} muted>
      Barcode lookup checks your saved foods first, offline. To also search USDA FoodData Central, get a free key at
      fdc.nal.usda.gov/api-key-signup and paste it here. It stays in this phone's Keychain and is never shown again or
      included in backups.
    </Label>
    <Field label={saved ? 'Replace key' : 'API key'} a11y="USDA API key" value={draft}
      onChangeText={text => { setDraft(text); setStatus(null); }} secureTextEntry autoCapitalize="none" autoCorrect={false}
      placeholder={saved ? 'Saved key hidden' : 'Paste your key'} error={status?.error ? status.text : undefined} />
    <Row style={{ gap: 8, flexWrap: 'wrap' }}>
      <Button primary label="Save USDA key" onPress={save}>Save key</Button>
      {saved ? <Button danger label="Remove USDA key" onPress={remove}>Remove key</Button> : null}
    </Row>
    {status && !status.error ? <Label accessibilityLiveRegion="polite" size={13} style={{ color: p.text }}>{status.text}</Label> : null}
  </Card>;
}
