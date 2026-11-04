// Moved from storybook/LoggingScreens.tsx and storybook/ProgramScreens.tsx (CreateFood).
// Fixtures became props and disabled reference buttons became callbacks. Removed for the live app:
// the illustrated keypad, the hour column (entries carry no time), and tabs or buttons for
// features that do not exist yet (Scan, AI, Library, Plate, Favorite, Impact on Targets).
import { Pressable, TextInput, View } from 'react-native';

import { Button, Card, Field, Label, Macros, palettes, Phone, Row, SearchBar, Segments, usePalette } from '../../ui';
import type { Food, FoodForm, FoodFormErrors } from '../foods/foods';
import { addDays, dayTotals, localDay, parseAmount, type Entry, type EntryForm, type FormErrors, type MacroTotal, type Nutrition, type Portion, type Unit } from './diary';

const round = (n: number) => Math.round(n * 10) / 10;
const grams = (n: number | null) => (n === null ? '?' : `${round(n)}`);
const macroLine = (n: Nutrition) => `${round(n.calories)} kcal  ${grams(n.protein)} P  ${grams(n.fat)} F  ${grams(n.carbs)} C`;
const describe = (n: Nutrition) => `${round(n.calories)} kcal · P ${grams(n.protein)} · C ${grams(n.carbs)} · F ${grams(n.fat)} g`;
const servingText = (f: Food) => (f.serving ? `${f.serving.name} (${round(f.serving.amount)} ${f.basis})` : '');
const portionText = (p: Portion | null) => (p ? `${round(p.amount)} ${p.unit}` : '');
const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// "≥17 g" marks a sum that omits unknown values; it is a floor, not the real total.
function formatMacro(total: MacroTotal, count: number): string {
  if (count > 0 && total.missing === count) return 'unknown';
  return `${total.missing > 0 ? '≥' : ''}${round(total.grams)} g`;
}

function formatDay(day: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { timeZone: 'UTC', ...options });
}

/** The day's running totals for the logger header; unknown macros stay "?". */
export function daySummary(entries: Nutrition[]): string {
  const t = dayTotals(entries);
  const macro = (m: MacroTotal) => (entries.length > 0 && m.missing === entries.length ? '?' : `${m.missing ? '≥' : ''}${round(m.grams)}`);
  return `${round(t.calories)} kcal   ${macro(t.protein)} P   ${macro(t.fat)} F   ${macro(t.carbs)} C`;
}

function LoggerHeader({ active, summary, onClose, onTab }: {
  active?: 'Search' | 'Quick Add'; summary: string; onClose: () => void; onTab?: (tab: 'Search' | 'Quick Add') => void;
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
      {(['Search', 'Quick Add'] as const).map(name => <Pressable key={name} role="tab" aria-selected={name === active}
        onPress={() => onTab?.(name)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12,
          borderBottomWidth: 2, borderColor: name === active ? p.text : 'transparent' }}>
        <Label size={12}>{name}</Label>
      </Pressable>)}
    </View> : null}
  </View>;
}

function FoodRow({ food, onPress }: { food: Food; onPress: () => void }) {
  const p = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${food.name}, ${round(food.calories)} kilocalories per 100 ${food.basis}`}
    accessibilityHint="Log a portion of this food" onPress={onPress}
    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, minHeight: 44,
      borderBottomWidth: 1, borderColor: p.border }, pressed && { opacity: 0.5 }]}>
    <View style={{ flex: 1, gap: 3 }}><Label size={13}>{food.name}</Label>
      <Label size={11} muted>{macroLine(food)}  ·  100 {food.basis}{food.serving ? `  ·  ${servingText(food)}` : ''}</Label></View>
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
export function FoodSearch({ summary, query, foods, onQuery, onFood, onNew, onClose, onQuickAdd }: {
  summary: string; query: string; foods: Food[]; onQuery: (query: string) => void; onFood: (food: Food) => void;
  onNew: () => void; onClose: () => void; onQuickAdd: () => void;
}) {
  return <Phone dark header={<LoggerHeader active="Search" summary={summary} onClose={onClose}
    onTab={tab => tab === 'Quick Add' && onQuickAdd()} />}
    footer={<SearchFooter query={query} onChange={onQuery} onNew={onNew} />}>
    <SearchBody query={query} foods={foods} onFood={onFood} />
  </Phone>;
}

// The original's plain-text arrows, given a 44-pt hit area.
function Chevron({ children, label, onPress }: { children: string; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
    <Label>{children}</Label>
  </Pressable>;
}

function TimelineBody({ day, entries, onDay, onEntry, onSettings }: {
  day: string; entries: Entry[]; onDay: (day: string) => void; onEntry: (entry: Entry) => void; onSettings: () => void;
}) {
  const p = usePalette();
  const totals = dayTotals(entries);
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
      {/* Balances the settings button so the date stays centred. */}
      <View style={{ width: 44 }} />
      <Row style={{ gap: 24 }}>
        <Chevron label="Previous day" onPress={() => onDay(addDays(day, -1))}>‹</Chevron>
        <Label accessibilityRole="header" style={{ minWidth: 120, textAlign: 'center' }}>
          {day === today ? 'Today' : formatDay(day, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </Label>
        <Chevron label="Next day" onPress={() => onDay(addDays(day, 1))}>›</Chevron>
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
    <Macros values={values} label={[`Total ${round(totals.calories)} kilocalories`,
      ...['protein', 'fat', 'carbs'].map((name, i) => `${name} ${spoken[i]}`),
      incomplete > 0 ? 'macro totals incomplete' : ''].filter(Boolean).join(', ')} />
    {incomplete > 0 ? <Label size={12} style={{ color: p.warning }}>
      Macro totals incomplete: {incomplete} {incomplete === 1 ? 'entry has' : 'entries have'} unknown macros.
    </Label> : null}
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
  </View>;
}

function LogFooter({ onSearch, onQuickAdd }: { onSearch: () => void; onQuickAdd: () => void }) {
  const p = usePalette();
  return <View style={{ backgroundColor: p.surface, paddingHorizontal: 16, paddingTop: 8 }}>
    <SearchBar onSearch={onSearch} onTools={onQuickAdd} toolsLabel="Quick add" />
  </View>;
}

/** The day's food log: day picker, macro totals, and entries; search opens the logger. */
export function FoodLog({ day, entries, onDay, onEntry, onSearch, onQuickAdd, onSettings }: {
  day: string; entries: Entry[]; onDay: (day: string) => void; onEntry: (entry: Entry) => void;
  onSearch: () => void; onQuickAdd: () => void; onSettings: () => void;
}) {
  return <Phone dark footer={<LogFooter onSearch={onSearch} onQuickAdd={onQuickAdd} />}>
    <TimelineBody day={day} entries={entries} onDay={onDay} onEntry={onEntry} onSettings={onSettings} />
  </Phone>;
}

const macroFields = [['protein', 'Protein'], ['fat', 'Fat'], ['carbs', 'Carbs']] as const;

/** Quick Add for a new entry, or a correction of a logged one, which never changes its food. */
export function QuickAdd({ summary, form, errors, saveError, correcting, portion, onField, onSave, onDelete, onClose, onSearch }: {
  summary: string; form: EntryForm; errors: FormErrors; saveError: string; correcting: boolean; portion: Portion | null;
  onField: (key: keyof EntryForm, text: string) => void; onSave: () => void; onDelete: () => void;
  onClose: () => void; onSearch: () => void;
}) {
  return <Phone dark header={<LoggerHeader active={correcting ? undefined : 'Quick Add'} summary={summary} onClose={onClose}
    onTab={tab => tab === 'Search' && onSearch()} />} footer={<Row style={{ justifyContent: 'flex-end', padding: 10, gap: 8 }}>
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
      {portion ? <Label muted size={12}>Logged as {portionText(portion)} of a saved food. Changes here affect only this entry, not the food.</Label> : null}
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

/** A saved food's portion: nutrition for the entered amount in its basis unit or its serving. */
export function FoodDetail({ summary, food, quantity, unit, preview, error, onQuantity, onUnit, onAdd, onBack, onEdit, onClose }: {
  summary: string; food: Food; quantity: string; unit: Unit | 'serving'; preview: { nutrition: Nutrition; portion: Portion } | null;
  error: string; onQuantity: (text: string) => void; onUnit: (unit: Unit | 'serving') => void; onAdd: () => void;
  onBack: () => void; onEdit: () => void; onClose: () => void;
}) {
  const p = palettes.light;
  const shown = preview?.nutrition ?? food;
  const units = food.serving ? [food.basis, food.serving.name] : null;
  return <Phone header={<LoggerHeader summary={summary} onClose={onClose} />} footer={<>
    <View style={{ paddingHorizontal: 18, gap: 8 }}>
      <Field label={unit === 'serving' ? `Servings of ${servingText(food)}` : 'Portion'}
        a11y={unit === 'serving' ? 'Number of servings' : `Amount in ${food.basis === 'g' ? 'grams' : 'millilitres'}`}
        value={quantity} onChangeText={onQuantity} suffix={unit === 'serving' ? food.serving?.name : food.basis}
        placeholder={unit === 'serving' ? '1' : '100'} keyboardType="decimal-pad" autoFocus error={error || undefined} />
      {units ? <Segments label="Unit" values={units} selected={unit === 'serving' ? units[1] : units[0]}
        names={{ [units[0]]: food.basis === 'g' ? 'Grams' : 'Millilitres', [units[1]]: `Servings of ${servingText(food)}` }}
        onChange={value => onUnit(value === units[0] ? food.basis : 'serving')} /> : null}
    </View>
    <Row style={{ justifyContent: 'flex-end', padding: 10, gap: 8 }}>
      <Button primary label="Add" onPress={onAdd}>Add</Button>
    </Row>
  </>}>
    <View style={{ padding: 18, gap: 16, backgroundColor: p.surface }}>
      <Row style={{ gap: 8 }}><Chevron label="Back to foods" onPress={onBack}>‹</Chevron>
        <Label accessibilityRole="header" size={13} style={{ flex: 1 }}>{food.name}</Label></Row>
      <Macros values={[`${round(shown.calories)}`, grams(shown.protein), grams(shown.fat), grams(shown.carbs)]} />
      {preview ? <Label size={12} accessibilityLiveRegion="polite">{portionText(preview.portion)}: {describe(preview.nutrition)}</Label> : null}
      <Label size={12} muted>Per 100 {food.basis}: {describe(food)}</Label>
      <Row style={{ gap: 10 }}><Button hint="Changes future logs only" onPress={onEdit}>Edit Food</Button></Row>
    </View>
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
