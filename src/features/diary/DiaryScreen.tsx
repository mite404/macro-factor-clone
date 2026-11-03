import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  addDays,
  dayTotals,
  deleteEntry,
  insertEntry,
  listEntries,
  localDay,
  parseEntryForm,
  updateEntry,
  type Entry,
  type EntryForm,
  type FormErrors,
  type MacroTotal,
} from './diary';

type Editing = { id: number | null; form: EntryForm };

const blankForm: EntryForm = { label: '', calories: '', protein: '', carbs: '', fat: '' };
const numberFields = [
  ['calories', 'Calories', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['carbs', 'Carbs', 'g'],
  ['fat', 'Fat', 'g'],
] as const;
const colors = { text: '#1c1c1e', muted: '#5f5f66', line: '#d1d1d6', tint: '#0a63c9', danger: '#c4231c' };

const round = (n: number) => Math.round(n * 10) / 10;
const toText = (n: number | null) => (n === null ? '' : String(n));
const grams = (n: number | null) => (n === null ? '?' : `${round(n)}`);

function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// "≥17 g" marks a sum that omits unknown values; it is a floor, not the real total.
function formatMacro(total: MacroTotal, entryCount: number): string {
  if (entryCount > 0 && total.missing === entryCount) return 'unknown';
  return `${total.missing > 0 ? '≥' : ''}${round(total.grams)} g`;
}

function Button(props: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger';
  a11y?: string;
  disabled?: boolean;
}) {
  const color = props.tone === 'danger' ? colors.danger : colors.tint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.a11y ?? props.label}
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.button, (pressed || props.disabled) && styles.pressed]}
    >
      <Text style={[styles.buttonText, { color }, props.tone === 'primary' && styles.bold]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

/** One day's quick-add diary: choose a day, log, edit, and delete entries, and see totals. */
export default function DiaryScreen() {
  const db = useSQLiteContext();
  const [day, setDay] = useState(() => localDay());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState('');
  // Synchronous lock: a second tap can land before React re-renders after the first.
  const writing = useRef(false);

  const reload = useCallback(async () => setEntries(await listEntries(db, day)), [db, day]);
  useEffect(() => {
    reload();
  }, [reload]);

  const totals = dayTotals(entries);
  const incomplete = entries.filter((e) => e.protein === null || e.carbs === null || e.fat === null).length;
  const isToday = day === localDay();

  function open(next: Editing | null) {
    setEditing(next);
    setErrors({});
    setSaveError('');
  }

  // Runs one write at a time, then closes the form; on failure the draft stays open.
  async function write(action: () => Promise<void>) {
    if (writing.current) return;
    writing.current = true;
    try {
      await action();
      open(null);
      await reload();
    } catch {
      setSaveError('Could not save. Your entry is still here; try again.');
    } finally {
      writing.current = false;
    }
  }

  function save() {
    if (!editing) return;
    const result = parseEntryForm(editing.form, day);
    if ('errors' in result) return setErrors(result.errors);
    const id = editing.id;
    write(() => (id === null ? insertEntry(db, result.entry) : updateEntry(db, id, result.entry)));
  }

  const setField = (key: keyof EntryForm) => (text: string) =>
    setEditing((e) => e && { ...e, form: { ...e.form, [key]: text } });

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.dayRow}>
        <Button label="‹ Prev" a11y="Previous day" disabled={!!editing} onPress={() => setDay(addDays(day, -1))} />
        <View style={styles.dayTitle}>
          <Text accessibilityRole="header" style={styles.title}>
            {isToday ? 'Today' : formatDay(day)}
          </Text>
          {isToday && <Text style={styles.muted}>{formatDay(day)}</Text>}
        </View>
        <Button label="Next ›" a11y="Next day" disabled={!!editing} onPress={() => setDay(addDays(day, 1))} />
      </View>
      {!isToday && <Button label="Go to today" disabled={!!editing} onPress={() => setDay(localDay())} />}

      <View style={styles.card} accessible accessibilityLabel={totalsLabel()}>
        <Text style={styles.big}>{round(totals.calories)} kcal</Text>
        <View style={styles.wrapRow}>
          <Text style={styles.text}>Protein {formatMacro(totals.protein, entries.length)}</Text>
          <Text style={styles.text}>Carbs {formatMacro(totals.carbs, entries.length)}</Text>
          <Text style={styles.text}>Fat {formatMacro(totals.fat, entries.length)}</Text>
        </View>
        {incomplete > 0 && (
          <Text style={styles.warning}>
            Macro totals incomplete: {incomplete} {incomplete === 1 ? 'entry has' : 'entries have'}{' '}
            unknown macros.
          </Text>
        )}
      </View>

      {editing ? (
        <View style={styles.card}>
          <View style={styles.formHeader}>
            <Button label="Cancel" onPress={() => open(null)} />
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {editing.id === null ? 'New entry' : 'Edit entry'}
            </Text>
            <Button label="Save" tone="primary" onPress={save} />
          </View>
          <Text style={styles.label}>Label</Text>
          <TextInput
            accessibilityLabel="Label"
            style={styles.input}
            value={editing.form.label}
            onChangeText={setField('label')}
            placeholder="Quick add"
            placeholderTextColor={colors.muted}
            returnKeyType="next"
            autoFocus={editing.id === null}
          />
          {numberFields.map(([key, label, unit]) => (
            <View key={key}>
              <Text style={styles.label}>
                {label} ({unit}){key === 'calories' ? '' : ', optional'}
              </Text>
              <TextInput
                accessibilityLabel={`${label} in ${unit === 'g' ? 'grams' : 'kilocalories'}`}
                style={[styles.input, errors[key] && styles.inputError]}
                value={editing.form[key]}
                onChangeText={setField(key)}
                keyboardType="decimal-pad"
                placeholder={key === 'calories' ? 'Required' : 'Unknown'}
                placeholderTextColor={colors.muted}
              />
              {errors[key] && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {errors[key]}
                </Text>
              )}
            </View>
          ))}
          {saveError !== '' && (
            <Text accessibilityRole="alert" style={styles.error}>
              {saveError}
            </Text>
          )}
          {editing.id !== null && (
            <Button label="Delete entry" tone="danger" onPress={() => write(() => deleteEntry(db, editing.id!))} />
          )}
        </View>
      ) : (
        <Button label="+ Add entry" tone="primary" onPress={() => open({ id: null, form: blankForm })} />
      )}

      {entries.length === 0 ? (
        <Text style={[styles.muted, styles.empty]}>No entries for this day yet.</Text>
      ) : (
        <View style={styles.card}>
          {entries.map((e, i) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`${e.label}, ${round(e.calories)} kilocalories, protein ${grams(e.protein)}, carbs ${grams(e.carbs)}, fat ${grams(e.fat)} grams`}
              accessibilityHint="Edit or delete this entry"
              onPress={() =>
                open({
                  id: e.id,
                  form: {
                    label: e.label,
                    calories: String(e.calories),
                    protein: toText(e.protein),
                    carbs: toText(e.carbs),
                    fat: toText(e.fat),
                  },
                })
              }
              style={({ pressed }) => [styles.entry, i > 0 && styles.divider, pressed && styles.pressed]}
            >
              <Text style={[styles.text, styles.entryLabel]}>{e.label}</Text>
              <Text style={styles.text}>{round(e.calories)} kcal</Text>
              <Text style={[styles.muted, styles.fullWidth]}>
                P {grams(e.protein)} · C {grams(e.carbs)} · F {grams(e.fat)} g
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );

  function totalsLabel() {
    const macro = (name: string, t: MacroTotal) => `${name} ${formatMacro(t, entries.length).replace('≥', 'at least ')}`;
    return [
      `Total ${round(totals.calories)} kilocalories`,
      macro('protein', totals.protein),
      macro('carbs', totals.carbs),
      macro('fat', totals.fat),
      incomplete > 0 ? 'macro totals incomplete' : '',
    ]
      .filter(Boolean)
      .join(', ');
  }
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center' },
  dayTitle: { flex: 1, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sectionTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 },
  big: { fontSize: 34, fontWeight: '700', color: colors.text },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  text: { fontSize: 17, color: colors.text },
  muted: { fontSize: 15, color: colors.muted },
  bold: { fontWeight: '600' },
  warning: { fontSize: 15, color: '#8a5a00' },
  empty: { textAlign: 'center', paddingVertical: 24 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, color: colors.muted, marginTop: 4 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 17,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 15, color: colors.danger },
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontSize: 17 },
  pressed: { opacity: 0.5 },
  entry: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8, columnGap: 8 },
  entryLabel: { flex: 1, minWidth: 120 },
  fullWidth: { width: '100%' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
