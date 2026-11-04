// Moved from storybook/LoggingScreens.tsx and storybook/ProgramScreens.tsx (CreateFood).
// Fixtures became props and disabled reference buttons became callbacks. Removed for the live app:
// the illustrated keypad, the hour column (entries carry no time), and tabs or buttons for
// features that do not exist yet (camera Scan, AI, Library, Plate, Favorite, Impact on Targets). The
// Barcode tab stands where the original's Scan tab is, for typed codes until the camera lands.
import type { ReactNode } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';

import { Button, Card, Field, Label, Macros, palettes, Phone, Row, SearchBar, Segments, usePalette } from '../../ui';
import type { Food, FoodForm, FoodFormErrors, FoodInput, Provenance } from '../foods/foods';
import { ODBL_URL, OFF_SOURCE } from '../lookup/lookup';
import { compareTargets, NUTRIENTS, type TargetRow, type Targets } from '../goals/goals';
import { addDays, dayTotals, localDay, parseAmount, type Entry, type EntryForm, type FormErrors, type MacroTotal, type Nutrition, type Portion, type Unit } from './diary';

/** One decimal place, as every nutrition figure in the logger shows. */
export const round = (n: number) => Math.round(n * 10) / 10;
const grams = (n: number | null) => (n === null ? '?' : `${round(n)}`);
const macroLine = (n: Nutrition) => `${round(n.calories)} kcal  ${grams(n.protein)} P  ${grams(n.fat)} F  ${grams(n.carbs)} C`;
/** "500 kcal · P 14.3 · C 42.9 · F 32.1 g", with "?" for an unknown macro. */
export const describe = (n: Nutrition) => `${round(n.calories)} kcal · P ${grams(n.protein)} · C ${grams(n.carbs)} · F ${grams(n.fat)} g`;
/** "cup (40 g)" for a food's serving, or '' without one. */
export const servingText = (f: FoodInput) => (f.serving ? `${f.serving.name} (${round(f.serving.amount)} ${f.basis})` : '');
const portionText = (p: Portion | null) => (p ? `${round(p.amount)} ${p.unit}` : '');
const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// "≥17 g" marks a sum that omits unknown values; it is a floor, not the real total.
function formatMacro(total: MacroTotal, count: number): string {
  if (count > 0 && total.missing === count) return 'unknown';
  return `${total.missing > 0 ? '≥' : ''}${round(total.grams)} g`;
}

/** Formats a YYYY-MM-DD calendar day without shifting it into the device's timezone. */
export function formatDay(day: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { timeZone: 'UTC', ...options });
}

/** "Today", or a day as "Sat, Oct 31, 2026". */
export const dayName = (day: string) =>
  day === localDay() ? 'Today' : formatDay(day, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** The day's running totals for the logger header; unknown macros stay "?". */
export function daySummary(entries: Nutrition[]): string {
  const t = dayTotals(entries);
  const macro = (m: MacroTotal) => (entries.length > 0 && m.missing === entries.length ? '?' : `${m.missing ? '≥' : ''}${round(m.grams)}`);
  return `${round(t.calories)} kcal   ${macro(t.protein)} P   ${macro(t.fat)} F   ${macro(t.carbs)} C`;
}

export type LoggerTab = 'Barcode' | 'Search' | 'Recipes' | 'Quick Add';

/** The logger's sheet header: close, the day's totals, and the ribbon of ways to log. */
export function LoggerHeader({ active, summary, onClose, onTab }: {
  active?: LoggerTab; summary: string; onClose: () => void; onTab?: (tab: LoggerTab) => void;
}) {
  const p = usePalette();
  return <View style={{ backgroundColor: p.surface }}>
    <Row style={{ padding: 12, gap: 8 }}><Button label="Close logger" onPress={onClose}>×</Button>
      <View style={{ flex: 1, gap: 3 }}>
        <Label size={10} muted>Today's log</Label>
        <View style={{ height: 2, backgroundColor: p.border }} />
        <Label size={10}>{summary}</Label>
      </View>
    </Row>
    <View style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: p.border, alignSelf: 'center', margin: 4 }} />
    {active ? <View accessibilityRole="tablist" style={{ flexDirection: 'row', justifyContent: 'space-around',
      paddingHorizontal: 12, borderBottomWidth: 2, borderColor: p.border }}>
      {(['Barcode', 'Search', 'Recipes', 'Quick Add'] as const).map(name => <Pressable key={name} role="tab" aria-selected={name === active}
        onPress={() => name !== active && onTab?.(name)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12,
          borderBottomWidth: 2, borderColor: name === active ? p.text : 'transparent' }}>
        <Label size={12}>{name}</Label>
      </Pressable>)}
    </View> : null}
  </View>;
}

/** A food result: name, brand, per-100 nutrition, serving, and an optional provenance line. */
export function FoodRow({ food, detail, hint = 'Log a portion of this food', onPress }: {
  food: FoodInput & Provenance; detail?: string; hint?: string; onPress: () => void;
}) {
  const p = usePalette();
  return <Pressable accessibilityRole="button"
    accessibilityLabel={`${food.name}${food.brand ? `, ${food.brand}` : ''}, ${round(food.calories)} kilocalories per 100 ${food.basis}`}
    accessibilityHint={hint} onPress={onPress}
    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, minHeight: 44,
      borderBottomWidth: 1, borderColor: p.border }, pressed && { opacity: 0.5 }]}>
    <View style={{ flex: 1, gap: 3 }}><Label size={13}>{food.name}</Label>
      <Label size={11} muted>{food.brand ? `${food.brand}  ·  ` : ''}{macroLine(food)}  ·  {'100\u00a0'}{food.basis}{food.serving ? `  ·  ${servingText(food)}` : ''}</Label>
      {detail ? <Label size={11} muted>{detail}</Label> : null}</View>
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.field, alignItems: 'center', justifyContent: 'center' }}>
      <Label>+</Label>
    </View>
  </Pressable>;
}

function SearchBody({ query, foods, onFood }: { query: string; foods: Food[]; onFood: (food: Food) => void }) {
  const p = usePalette();
  const trimmed = query.trim();
  return <View style={{ padding: 16, backgroundColor: p.surface, flexGrow: 1 }}>
    <Label>{trimmed ? 'Matching saved foods' : 'Saved Foods'}</Label>
    {foods.map(food => <FoodRow key={food.id} food={food} onPress={() => onFood(food)} />)}
    {foods.length === 0 ? <Label muted style={{ paddingVertical: 30 }}>
      {trimmed ? `No saved foods match "${trimmed}". Tap New Food to create it.`
        : 'No saved foods yet. Tap New Food to save one with its nutrition per 100 g or 100 ml.'}
    </Label> : null}
  </View>;
}

function SearchFooter({ query, onChange, onNew }: { query: string; onChange: (value: string) => void; onNew: () => void }) {
  const p = usePalette();
  return <Row style={{ padding: 12, gap: 8, backgroundColor: p.surface }}>
    <TextInput accessibilityLabel="Search saved foods" value={query} onChangeText={onChange}
      placeholder="Search for a food" placeholderTextColor={p.muted} autoFocus autoCorrect={false} returnKeyType="search"
      style={{ flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 15, borderRadius: 24,
        color: p.text, backgroundColor: p.field, fontSize: 14 }} />
    <Button primary label="New food" onPress={onNew}>New Food</Button>
  </Row>;
}

/** Saved-food search: header totals, local results, and the bottom search field. */
export function FoodSearch({ summary, query, foods, onQuery, onFood, onNew, onClose, onTab }: {
  summary: string; query: string; foods: Food[]; onQuery: (query: string) => void; onFood: (food: Food) => void;
  onNew: () => void; onClose: () => void; onTab: (tab: LoggerTab) => void;
}) {
  return <Phone dark header={<LoggerHeader active="Search" summary={summary} onClose={onClose} onTab={onTab} />}
    footer={<SearchFooter query={query} onChange={onQuery} onNew={onNew} />}>
    <SearchBody query={query} foods={foods} onFood={onFood} />
  </Phone>;
}

/** The original's plain-text arrows, given a 44-pt hit area. `value`, such as the day shown, is read after a press. */
export function Chevron({ children, label, value, onPress }: { children: string; label: string; value?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} aria-valuetext={value} onPress={onPress}
    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
    <Label>{children}</Label>
  </Pressable>;
}

// The one current target set, compared with the day shown. Status is text, never color alone.
function TargetsCard({ rows, onTargets }: { rows: TargetRow[]; onTargets: () => void }) {
  const p = usePalette();
  if (rows.length === 0) return <Row style={{ gap: 12, justifyContent: 'space-between' }}>
    <Label size={12} muted style={{ flex: 1 }}>No daily targets set. Intake is shown without a goal.</Label>
    <Button onPress={onTargets}>Set targets</Button>
  </Row>;
  return <View style={{ gap: 10 }}>
    <Row style={{ gap: 12 }}>
      <View style={{ flex: 1 }}><Label weight="600">Current targets</Label>
        <Label size={11} muted>Your targets now, compared with this day</Label></View>
      <Button label="Edit targets" onPress={onTargets}>Edit</Button>
    </Row>
    <Card style={{ paddingVertical: 4, gap: 0 }}>
      {rows.map((row, i) => <Row key={row.nutrient} style={{ gap: 12, alignItems: 'flex-start', paddingVertical: 10,
        borderTopWidth: i === 0 ? 0 : 1, borderColor: p.border }}>
        <View style={{ flex: 1, gap: 4 }}><Label size={13}>{row.name}</Label>
          <Label size={11} muted>{row.amount}</Label></View>
        <Label size={12} style={{ flex: 1.4, textAlign: 'right', color: row.over ? p.danger : row.incomplete ? p.warning : p.text }}>
          {row.status}
        </Label>
      </Row>)}
    </Card>
  </View>;
}

function TimelineBody({ day, entries, targets, notice, onDay, onEntry, onCopy, onSettings, onTargets, onWeight }: {
  day: string; entries: Entry[]; targets: Targets; notice?: string; onDay: (day: string) => void; onEntry: (entry: Entry) => void;
  onCopy: () => void; onSettings: () => void; onTargets: () => void; onWeight: () => void;
}) {
  const p = usePalette();
  const totals = dayTotals(entries);
  const rows = compareTargets(targets, totals, entries.length);
  const row = (key: string) => rows.find(r => r.nutrient === key);
  const today = localDay();
  const [y, m, d] = day.split('-').map(Number);
  const monday = addDays(day, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7));
  const week = weekdays.map((_, i) => addDays(monday, i));
  const incomplete = entries.filter(e => e.protein === null || e.carbs === null || e.fat === null).length;
  const values = [`${round(totals.calories)}`, ...[totals.protein, totals.fat, totals.carbs].map(t =>
    formatMacro(t, entries.length).replace(' g', '').replace('unknown', '?'))];
  const spoken = [totals.protein, totals.fat, totals.carbs].map(t => formatMacro(t, entries.length).replace('≥', 'at least '));
  return <View style={{ padding: 16, gap: 18 }}>
    <Row style={{ justifyContent: 'space-between' }}>
      <Chevron label="Weight history" onPress={onWeight}>⚖︎</Chevron>
      <Row style={{ gap: 24 }}>
        <Chevron label="Previous day" value={dayName(day)} onPress={() => onDay(addDays(day, -1))}>‹</Chevron>
        <Label accessibilityRole="header" style={{ minWidth: 120, textAlign: 'center' }}>{dayName(day)}</Label>
        <Chevron label="Next day" value={dayName(day)} onPress={() => onDay(addDays(day, 1))}>›</Chevron>
      </Row>
      <Chevron label="Settings" onPress={onSettings}>⚙︎</Chevron>
    </Row>
    <Row style={{ justifyContent: 'space-between' }}>{week.map((date, i) =>
      <Pressable key={date} accessibilityRole="button" aria-selected={date === day}
        accessibilityLabel={formatDay(date, { weekday: 'long', month: 'long', day: 'numeric' })}
        onPress={() => onDay(date)} style={{ minWidth: 44, minHeight: 44, padding: 6, borderRadius: 22, borderWidth: 1,
          borderColor: date === today ? p.text : p.border, backgroundColor: date === day ? p.field : 'transparent',
          justifyContent: 'center' }}>
        <Label size={12} style={{ textAlign: 'center' }}>{`${weekdays[i]}\n${Number(date.slice(8))}`}</Label>
      </Pressable>)}
    </Row>
    {day !== today ? <Button onPress={() => onDay(today)} style={{ alignSelf: 'center' }}>Go to today</Button> : null}
    {notice ? <Label role="status" size={12} style={{ textAlign: 'center' }}>{notice}</Label> : null}
    <Macros values={values} targets={rows.length === 0 ? undefined : NUTRIENTS.map(([key, , unit]) => {
      const target = targets[key];
      return target === undefined ? null : `${round(target)}${unit === 'g' ? ' g' : ''}`;
    })} fills={NUTRIENTS.map(([key]) => row(key)?.fill ?? 0)} over={NUTRIENTS.map(([key]) => row(key)?.over ?? false)}
    label={[`Total ${round(totals.calories)} kilocalories`,
      ...['protein', 'fat', 'carbs'].map((name, i) => `${name} ${spoken[i]}`),
      incomplete > 0 ? 'macro totals incomplete' : ''].filter(Boolean).join(', ')} />
    {incomplete > 0 ? <Label size={12} style={{ color: p.warning }}>
      Macro totals incomplete: {incomplete} {incomplete === 1 ? 'entry has' : 'entries have'} unknown macros.
    </Label> : null}
    <TargetsCard rows={rows} onTargets={onTargets} />
    {entries.length === 0 ? <Label muted style={{ textAlign: 'center', paddingVertical: 24 }}>No entries for this day yet.</Label> : null}
    {entries.map(e => <Pressable key={e.id} accessibilityRole="button"
      accessibilityLabel={`${e.label}, ${e.portion ? `${portionText(e.portion)}, ` : ''}${round(e.calories)} kilocalories, protein ${grams(e.protein)}, carbs ${grams(e.carbs)}, fat ${grams(e.fat)} grams`}
      accessibilityHint="Edit or delete this entry" onPress={() => onEntry(e)}
      style={({ pressed }) => pressed && { opacity: 0.5 }}>
      <Card style={{ padding: 12 }}><Row style={{ gap: 10 }}><View style={{ flex: 1 }}>
        <Label size={13}>{e.label}</Label>
        <Label size={11} muted>{macroLine(e)}{e.portion ? ` · ${portionText(e.portion)}` : ''}</Label>
      </View><Label>✎</Label></Row></Card>
    </Pressable>)}
    {entries.length > 0 ? <Button hint="Choose entries from this day to copy to another day" onPress={onCopy}
      style={{ alignSelf: 'flex-start' }}>Copy entries</Button> : null}
  </View>;
}

function LogFooter({ onSearch, onBarcode, onQuickAdd }: { onSearch: () => void; onBarcode: () => void; onQuickAdd: () => void }) {
  const p = usePalette();
  return <View style={{ backgroundColor: p.surface, paddingHorizontal: 16, paddingTop: 8 }}>
    <SearchBar onSearch={onSearch} onBarcode={onBarcode} onTools={onQuickAdd} toolsLabel="Quick add" />
  </View>;
}

/** The day's food log: day picker, totals against the current targets, and entries; search opens the logger. */
export function FoodLog({ day, entries, targets, notice, onDay, onEntry, onCopy, onSearch, onBarcode, onQuickAdd, onSettings, onTargets, onWeight }: {
  day: string; entries: Entry[]; targets: Targets; notice?: string; onDay: (day: string) => void; onEntry: (entry: Entry) => void;
  onCopy: () => void; onSearch: () => void; onBarcode: () => void; onQuickAdd: () => void; onSettings: () => void;
  onTargets: () => void; onWeight: () => void;
}) {
  return <Phone dark footer={<LogFooter onSearch={onSearch} onBarcode={onBarcode} onQuickAdd={onQuickAdd} />}>
    <TimelineBody day={day} entries={entries} targets={targets} notice={notice} onDay={onDay} onEntry={onEntry}
      onCopy={onCopy} onSettings={onSettings} onTargets={onTargets} onWeight={onWeight} />
  </Phone>;
}

/** Selects entries of `day` with visible checkboxes and copies them, as logged, to day `to`. */
export function CopyEntries({ copying, onCopy, onBack, ...body }: Parameters<typeof CopyBody>[0] & {
  copying: boolean; onCopy: () => void; onBack: () => void;
}) {
  const n = body.ids.length;
  return <Phone dark title="Copy entries" onBack={onBack} backLabel="Cancel" footer={<LoggerFooter>
    <Button primary disabled={n === 0 || copying} onPress={onCopy}>
      {n === 0 ? 'Select entries to copy' : copying ? 'Copying…' : `Copy ${n} ${n === 1 ? 'entry' : 'entries'}`}
    </Button>
  </LoggerFooter>}>
    <CopyBody {...body} />
  </Phone>;
}

function CopyBody({ day, entries, ids, to, error, onToggle, onTo }: {
  day: string; entries: Entry[]; ids: number[]; to: string; error: string; onToggle: (id: number) => void; onTo: (day: string) => void;
}) {
  const p = usePalette();
  return <LoggerBody>
    <Label accessibilityRole="header" weight="600">From {dayName(day)}</Label>
    <Label size={12} muted>Copies keep the nutrition as logged. The original entries stay as they are.</Label>
    <View>{entries.map(e => {
      const checked = ids.includes(e.id);
      return <Pressable key={e.id} role="checkbox" aria-checked={checked} onPress={() => onToggle(e.id)}
        accessibilityLabel={`${e.label}, ${e.portion ? `${portionText(e.portion)}, ` : ''}${round(e.calories)} kilocalories`}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 44, paddingVertical: 10,
          borderBottomWidth: 1, borderColor: p.border }, pressed && { opacity: 0.5 }]}>
        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: checked ? p.text : p.muted,
          backgroundColor: checked ? p.text : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {checked ? <Label size={14} weight="700" style={{ color: p.inverse }}>✓</Label> : null}
        </View>
        <View style={{ flex: 1 }}><Label size={13}>{e.label}</Label>
          <Label size={11} muted>{macroLine(e)}{e.portion ? ` · ${portionText(e.portion)}` : ''}</Label></View>
      </Pressable>;
    })}</View>
    <Label size={13}>Copy to</Label>
    <Row style={{ justifyContent: 'center', gap: 24 }}>
      <Chevron label="Previous destination day" value={dayName(to)} onPress={() => onTo(addDays(to, -1))}>‹</Chevron>
      <Label style={{ minWidth: 120, textAlign: 'center' }}>{dayName(to)}</Label>
      <Chevron label="Next destination day" value={dayName(to)} onPress={() => onTo(addDays(to, 1))}>›</Chevron>
    </Row>
    {to === day ? <Label size={12} style={{ color: p.warning }}>Same day: copies are added next to the originals.</Label> : null}
    {error ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{error}</Label> : null}
  </LoggerBody>;
}

const macroFields = [['protein', 'Protein'], ['fat', 'Fat'], ['carbs', 'Carbs']] as const;

/** Quick Add for a new entry, or a correction of a logged one, which never changes its food. */
export function QuickAdd({ summary, form, errors, saveError, correcting, portion, onField, onSave, onDelete, onClose, onTab }: {
  summary: string; form: EntryForm; errors: FormErrors; saveError: string; correcting: boolean; portion: Portion | null;
  onField: (key: keyof EntryForm, text: string) => void; onSave: () => void; onDelete: () => void;
  onClose: () => void; onTab: (tab: LoggerTab) => void;
}) {
  return <Phone dark header={<LoggerHeader active={correcting ? undefined : 'Quick Add'} summary={summary} onClose={onClose}
    onTab={onTab} />} footer={<Row style={{ justifyContent: 'flex-end', padding: 10, gap: 8 }}>
      {correcting ? <Button danger onPress={onDelete}>Delete entry</Button> : null}
      <Button primary onPress={onSave}>{correcting ? 'Save' : 'Log Food'}</Button>
    </Row>}>
    <QuickAddBody form={form} errors={errors} saveError={saveError} correcting={correcting} portion={portion} onField={onField} />
  </Phone>;
}

function QuickAddBody({ form, errors, saveError, correcting, portion, onField }: {
  form: EntryForm; errors: FormErrors; saveError: string; correcting: boolean; portion: Portion | null;
  onField: (key: keyof EntryForm, text: string) => void;
}) {
  const p = usePalette();
  const [protein, fat, carbs] = [form.protein, form.fat, form.carbs].map(parseAmount);
  // Shown as a hint only; the entered calories are what the diary stores.
  const macroSum = typeof protein === 'number' && typeof fat === 'number' && typeof carbs === 'number'
    ? round(protein * 4 + carbs * 4 + fat * 9) : null;
  return <View style={{ padding: 18, gap: 12 }}>
      {correcting ? <Label accessibilityRole="header" weight="600">Edit entry</Label> : null}
      {portion ? <Label muted size={12}>Logged as {portionText(portion)} of {portion.foodId === null ? 'a recipe' : 'a saved food'}. Changes here affect only this entry, not the {portion.foodId === null ? 'recipe' : 'food'}.</Label> : null}
      <Field label="Energy" a11y="Calories in kilocalories" value={form.calories} onChangeText={t => onField('calories', t)}
        suffix="kcal" placeholder="Required" keyboardType="decimal-pad" error={errors.calories} autoFocus={!correcting} />
      {macroSum !== null ? <Label muted size={12}>Macro sum is {macroSum} kcal</Label> : null}
      <Row style={{ gap: 12, alignItems: 'flex-start' }}>{macroFields.map(([key, name]) =>
        <Field key={key} label={name} a11y={`${name} in grams`} value={form[key]} onChangeText={t => onField(key, t)}
          suffix="g" placeholder="?" keyboardType="decimal-pad" error={errors[key]} style={{ flex: 1 }} />)}
      </Row>
      <Label muted size={12}>Leave a macro blank if it is unknown. A 0 means none.</Label>
      <Field label="Name" a11y="Label" value={form.label} onChangeText={t => onField('label', t)} placeholder="Quick add" />
      {saveError ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{saveError}</Label> : null}
    </View>;
}

/** The logger's scrolling content: one surface from the header down to the footer. */
export function LoggerBody({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <View style={{ padding: 16, gap: 16, backgroundColor: p.surface, flexGrow: 1 }}>{children}</View>;
}

/**
 * The detail screens' pinned footer, on the body's surface so no band shows between them, and
 * inset like the body so fields line up with the text above.
 */
export function LoggerFooter({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8, backgroundColor: p.surface }}>{children}</View>;
}

/** Back arrow, food name, and brand, as the food detail and the USDA review title them. */
export function FoodTitle({ food, backLabel, onBack }: { food: FoodInput & Provenance; backLabel: string; onBack: () => void }) {
  return <Row style={{ gap: 8 }}><Chevron label={backLabel} onPress={onBack}>‹</Chevron>
    <View style={{ flex: 1 }}><Label accessibilityRole="header" size={13}>{food.name}</Label>
      {food.brand ? <Label size={11} muted>{food.brand}</Label> : null}</View></Row>;
}

// One labelled value in a food's facts card, divided like the targets card rows. A `url` makes
// the value a link that opens in the browser.
function Fact({ name, value, url, first = false }: { name: string; value: string; url?: string; first?: boolean }) {
  const p = usePalette();
  const text = <Label size={12} style={[{ textAlign: 'right' }, url ? { textDecorationLine: 'underline' } : null]}>{value}</Label>;
  return <Row style={{ gap: 12, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderColor: p.border }}>
    <Label size={12} muted style={{ flex: 1 }}>{name}</Label>
    {url ? <Pressable accessibilityRole="link" accessibilityHint="Opens in your browser" onPress={() => Linking.openURL(url)}
      hitSlop={12} style={({ pressed }) => [{ flex: 2, alignItems: 'flex-end' }, pressed && { opacity: 0.5 }]}>{text}</Pressable>
      : <View style={{ flex: 2 }}>{text}</View>}
  </Row>;
}

/**
 * Barcode, serving, and where an imported food came from, with the license for Open Food Facts
 * data. `published` is the provider's record date.
 */
export function FoodFacts({ food, published, saved }: { food: FoodInput & Provenance; published?: string | null; saved: string }) {
  const p = usePalette();
  const record = food.source ? `${food.source.id.replace(/^(fdc|off):/, '')}${published ? `, published ${published}` : ''}` : null;
  return <Card style={{ paddingVertical: 4, gap: 0, borderWidth: 1, borderColor: p.border }}>
    {[
      food.barcode ? ['Barcode', food.barcode] : null,
      ['Serving', food.serving ? servingText(food) : 'None listed'],
      food.source ? ['Source', food.source.name] : null,
      record ? ['Record', record] : null,
      food.source ? [saved, food.source.retrievedOn] : null,
      food.source?.name === OFF_SOURCE ? ['License', 'Open Database License', ODBL_URL] : null,
    ].filter(row => row !== null).map(([name, value, url], i) => <Fact key={name} first={i === 0} name={name} value={value} url={url} />)}
  </Card>;
}

/** A saved food's portion: nutrition for the entered amount in its basis unit or its serving. */
export function FoodDetail({ summary, food, quantity, unit, preview, error, onQuantity, onUnit, onAdd, onBack, onEdit, onClose }: {
  summary: string; food: Food; quantity: string; unit: Unit | 'serving'; preview: { nutrition: Nutrition; portion: Portion } | null;
  error: string; onQuantity: (text: string) => void; onUnit: (unit: Unit | 'serving') => void; onAdd: () => void;
  onBack: () => void; onEdit: () => void; onClose: () => void;
}) {
  const shown = preview?.nutrition ?? food;
  const units = food.serving ? [food.basis, food.serving.name] : null;
  return <Phone dark header={<LoggerHeader summary={summary} onClose={onClose} />} footer={<LoggerFooter>
    <Field label={unit === 'serving' ? `Servings of ${servingText(food)}` : 'Portion'}
      a11y={unit === 'serving' ? 'Number of servings' : `Amount in ${food.basis === 'g' ? 'grams' : 'millilitres'}`}
      value={quantity} onChangeText={onQuantity} suffix={unit === 'serving' ? food.serving?.name : food.basis}
      placeholder={unit === 'serving' ? '1' : '100'} keyboardType="decimal-pad" autoFocus error={error || undefined} />
    <Row style={{ gap: 8 }}>
      <View style={{ flex: 1 }}>{units ? <Segments label="Unit" values={units} selected={unit === 'serving' ? units[1] : units[0]}
        names={{ [units[0]]: food.basis === 'g' ? 'Grams' : 'Millilitres', [units[1]]: `Servings of ${servingText(food)}` }}
        onChange={value => onUnit(value === units[0] ? food.basis : 'serving')} /> : null}</View>
      <Button primary label="Add" onPress={onAdd}>Add</Button>
    </Row>
  </LoggerFooter>}>
    <LoggerBody>
      <FoodTitle food={food} backLabel="Back to foods" onBack={onBack} />
      <Macros values={[`${round(shown.calories)}`, grams(shown.protein), grams(shown.fat), grams(shown.carbs)]} />
      {preview ? <Label size={12} accessibilityLiveRegion="polite">{portionText(preview.portion)}: {describe(preview.nutrition)}</Label> : null}
      <Label size={12} muted>Per 100 {food.basis}: {describe(food)}</Label>
      {food.barcode || food.source ? <FoodFacts food={food} saved="Saved" /> : null}
      {food.source ? <Label size={12} muted>Edits change only this saved copy, not past diary entries.</Label> : null}
      <Row style={{ gap: 10 }}><Button hint="Changes future logs only" onPress={onEdit}>Edit Food</Button></Row>
    </LoggerBody>
  </Phone>;
}

/** Create or edit a saved food; edits apply to future logs and never rewrite the diary. */
export function CreateFood({ editing, form, errors, error, onField, onSave, onBack, onArchive }: {
  editing: boolean; form: FoodForm; errors: FoodFormErrors; error: string;
  onField: <K extends keyof FoodForm>(key: K, value: FoodForm[K]) => void;
  onSave: () => void; onBack: () => void; onArchive: () => void;
}) {
  const p = palettes.light;
  const unitWord = form.basis === 'g' ? 'grams' : 'millilitres';
  return <Phone title={editing ? 'Edit Food' : 'Create Food'} onBack={onBack} backLabel="Cancel"
    footer={<View style={{ padding: 18, backgroundColor: p.surface }}><Button primary onPress={onSave}>Save</Button></View>}>
    <View style={{ padding: 18, gap: 24, backgroundColor: p.surface, flexGrow: 1 }}>
      <Label size={21} weight="600">Build your food</Label>
      {editing ? <Label muted size={12}>Changes apply to future logs. Past diary entries keep their values.</Label> : null}
      <Card style={{ borderWidth: 1, borderColor: p.border }}><Row style={{ gap: 12 }}>
        <View style={{ flex: 1 }}><Label>{form.name.trim() || 'New food'}</Label>
          <Label size={12} muted>Nutrition per 100 {form.basis}</Label></View>
      </Row></Card>
      <Field label="Food Name" a11y="Name" value={form.name} onChangeText={t => onField('name', t)} error={errors.name}
        autoFocus={!editing && form.name === ''} />
      <Field label="Barcode, optional" value={form.barcode} onChangeText={t => onField('barcode', t)} error={errors.barcode}
        keyboardType="number-pad" />
      <Label>Nutrition is per</Label>
      <Segments label="Nutrition is per" values={['100 g', '100 ml']} selected={`100 ${form.basis}`}
        names={{ '100 g': '100 grams', '100 ml': '100 millilitres' }}
        onChange={value => onField('basis', value === '100 g' ? 'g' : 'ml')} />
      <Field label="Energy" a11y={`Calories per 100 ${unitWord}`} value={form.calories} onChangeText={t => onField('calories', t)}
        suffix="kcal" placeholder="Required" keyboardType="decimal-pad" error={errors.calories} />
      <Row style={{ gap: 12, alignItems: 'flex-start' }}>{macroFields.map(([key, name]) =>
        <Field key={key} label={name} a11y={`${key} in grams per 100 ${unitWord}`} value={form[key]}
          onChangeText={t => onField(key, t)} suffix="g" placeholder="?" keyboardType="decimal-pad" error={errors[key]}
          style={{ flex: 1 }} />)}
      </Row>
      <Field label="Serving name, optional" value={form.servingName} onChangeText={t => onField('servingName', t)}
        error={errors.servingName} placeholder="cup, slice, bottle" />
      <Field label="Serving amount" a11y={`Serving amount in ${unitWord}`} value={form.servingAmount}
        onChangeText={t => onField('servingAmount', t)} error={errors.servingAmount} suffix={form.basis}
        placeholder={`Measured in ${form.basis}`} keyboardType="decimal-pad" />
      {error ? <Label accessibilityRole="alert" size={12} style={{ color: p.danger }}>{error}</Label> : null}
      {editing ? <Button danger hint="Hides it from search. Diary entries stay." onPress={onArchive}>Archive food</Button> : null}
    </View>
  </Phone>;
}
