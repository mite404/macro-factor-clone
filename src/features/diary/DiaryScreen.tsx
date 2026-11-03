import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, colors, Field, macroColors, ui } from '../../ui';
import FoodPanel from '../foods/FoodPanel';
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

// The open panel: an entry form (new quick add or correction) or the saved-food logger.
type Editing = { kind: 'entry'; id: number | null; form: EntryForm; portion: Entry['portion'] } | { kind: 'food' };

const blankForm: EntryForm = { label: '', calories: '', protein: '', carbs: '', fat: '' };
const numberFields = [
  ['calories', 'Calories', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['carbs', 'Carbs', 'g'],
  ['fat', 'Fat', 'g'],
] as const;

const macroNames = [
  ['protein', 'Protein'],
  ['carbs', 'Carbs'],
  ['fat', 'Fat'],
] as const;

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

const portionText = (e: Entry) => (e.portion ? `${round(e.portion.amount)} ${e.portion.unit} · ` : '');

/** One day's diary: choose a day, quick-add or log saved foods, edit and delete entries, see totals. */
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
    if (editing?.kind !== 'entry') return;
    const result = parseEntryForm(editing.form, day);
    if ('errors' in result) return setErrors(result.errors);
    const id = editing.id;
    write(() => (id === null ? insertEntry(db, result.entry) : updateEntry(db, id, result.entry)));
  }

  const setField = (key: keyof EntryForm) => (text: string) =>
    setEditing((e) => e?.kind === 'entry' ? { ...e, form: { ...e.form, [key]: text } } : e);

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
          {macroNames.map(([key, name]) => (
            <View key={key} style={styles.macro}>
              <View style={[styles.swatch, { backgroundColor: macroColors[key] }]} />
              <Text style={styles.text}>
                {name} {formatMacro(totals[key], entries.length)}
              </Text>
            </View>
          ))}
        </View>
        {incomplete > 0 && (
          <Text style={styles.warning}>
            Macro totals incomplete: {incomplete} {incomplete === 1 ? 'entry has' : 'entries have'}{' '}
            unknown macros.
          </Text>
        )}
      </View>

      {editing?.kind === 'food' ? (
        <FoodPanel
          day={day}
          onClose={() => {
            open(null);
            reload();
          }}
        />
      ) : editing ? (
        <View style={styles.card}>
          <View style={styles.formHeader}>
            <Button label="Cancel" onPress={() => open(null)} />
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {editing.id === null ? 'New entry' : 'Edit entry'}
            </Text>
            <Button label="Save" tone="primary" onPress={save} />
          </View>
          {editing.portion && (
            <Text style={styles.muted}>
              Logged as {round(editing.portion.amount)} {editing.portion.unit} of a saved food. Changes here
              affect only this entry, not the food.
            </Text>
          )}
          <Field
            label="Label"
            value={editing.form.label}
            onChangeText={setField('label')}
            placeholder="Quick add"
            returnKeyType="next"
            autoFocus={editing.id === null}
          />
          {numberFields.map(([key, label, unit]) => (
            <Field
              key={key}
              label={key === 'calories' ? label : `${label}, optional`}
              a11y={`${label} in ${unit === 'g' ? 'grams' : 'kilocalories'}`}
              suffix={unit}
              value={editing.form[key]}
              onChangeText={setField(key)}
              error={errors[key]}
              keyboardType="decimal-pad"
              placeholder={key === 'calories' ? 'Required' : 'Unknown'}
            />
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
        <View style={styles.addRow}>
          <Button label="+ Log food" tone="primary" onPress={() => open({ kind: 'food' })} />
          <Button
            label="+ Quick add"
            tone="primary"
            onPress={() => open({ kind: 'entry', id: null, form: blankForm, portion: null })}
          />
        </View>
      )}

      {entries.length === 0 ? (
        <Text style={[styles.muted, styles.empty]}>No entries for this day yet.</Text>
      ) : (
        <View style={styles.card}>
          {entries.map((e, i) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`${e.label}, ${portionText(e).replace(' · ', ', ')}${round(e.calories)} kilocalories, protein ${grams(e.protein)}, carbs ${grams(e.carbs)}, fat ${grams(e.fat)} grams`}
              accessibilityHint="Edit or delete this entry"
              onPress={() =>
                open({
                  kind: 'entry',
                  id: e.id,
                  portion: e.portion,
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
                {portionText(e)}P {grams(e.protein)} · C {grams(e.carbs)} · F {grams(e.fat)} g
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
  ...ui,
  content: { padding: 16, gap: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center' },
  dayTitle: { flex: 1, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  big: { fontSize: 34, fontWeight: '700', color: colors.text },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  warning: { fontSize: 15, color: '#8a5a00' },
  empty: { textAlign: 'center', paddingVertical: 24 },
  addRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  entry: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8, columnGap: 8 },
  entryLabel: { flex: 1, minWidth: 120 },
  fullWidth: { width: '100%' },
});
