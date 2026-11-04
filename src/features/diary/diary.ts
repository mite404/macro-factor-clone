import type { Db } from '../../storage/migrations';

// null means unknown, which is different from a logged 0.
export type Nutrition = {
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};
// day is a local calendar date, YYYY-MM-DD, chosen by the user and never recomputed.
export type EntryInput = Nutrition & { day: string; label: string };
export type Unit = 'g' | 'ml';
// The measured amount logged from a saved food. Quick-add entries have none.
export type Portion = { foodId: number | null; amount: number; unit: Unit };
export type Entry = EntryInput & { id: number; portion: Portion | null };

export type NutritionForm = Record<'calories' | 'protein' | 'carbs' | 'fat', string>;
export type EntryForm = NutritionForm & { label: string };
export type FormErrors = Partial<Record<keyof EntryForm, string>>;
export type MacroTotal = { grams: number; missing: number };
export type DayTotals = {
  calories: number;
  protein: MacroTotal;
  carbs: MacroTotal;
  fat: MacroTotal;
};

const pad = (n: number) => String(n).padStart(2, '0');
const macros = ['protein', 'carbs', 'fat'] as const;

/** '' → null (unknown); otherwise a non-negative finite decimal, or undefined when invalid. */
export function parseAmount(text: string): number | null | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

/** The device's current local calendar day as YYYY-MM-DD. */
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Calendar arithmetic on a YYYY-MM-DD string, independent of timezone and DST. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Validates nutrition text at the input boundary. Calories are required; blank macros are unknown. */
export function parseNutrition(
  form: NutritionForm,
): { nutrition: Nutrition } | { errors: Partial<Record<keyof NutritionForm, string>> } {
  const errors: Partial<Record<keyof NutritionForm, string>> = {};
  const message = 'Enter a number of 0 or more';
  const calories = parseAmount(form.calories);
  if (calories === null) errors.calories = 'Calories are required';
  else if (calories === undefined) errors.calories = message;
  const parsed = Object.fromEntries(macros.map((key) => [key, parseAmount(form[key])]));
  for (const key of macros) if (parsed[key] === undefined) errors[key] = message;
  if (Object.keys(errors).length > 0) return { errors };
  return {
    nutrition: { calories: calories!, protein: parsed.protein!, carbs: parsed.carbs!, fat: parsed.fat! },
  };
}

/** Validates a quick-add or correction form for the given day. */
export function parseEntryForm(
  form: EntryForm,
  day: string,
): { entry: EntryInput } | { errors: FormErrors } {
  const result = parseNutrition(form);
  if ('errors' in result) return result;
  return { entry: { day, label: form.label.trim() || 'Quick add', ...result.nutrition } };
}

/** Sums a day's snapshots; `missing` counts entries whose macro is unknown. */
export function dayTotals(entries: Nutrition[]): DayTotals {
  const macro = (key: (typeof macros)[number]): MacroTotal => ({
    grams: entries.reduce((sum, e) => sum + (e[key] ?? 0), 0),
    missing: entries.filter((e) => e[key] === null).length,
  });
  return {
    calories: entries.reduce((sum, e) => sum + e.calories, 0),
    protein: macro('protein'),
    carbs: macro('carbs'),
    fat: macro('fat'),
  };
}

/** Entries logged for one calendar day, in logging order. */
export async function listEntries(db: Db, day: string): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryInput & { id: number; foodId: number | null; amount: number | null; unit: Unit | null }>(
    `SELECT id, day, label, calories, protein, carbs, fat, food_id AS foodId, amount, unit
     FROM diary_entries WHERE day = ? ORDER BY id`,
    [day],
  );
  // The schema keeps amount and unit set together.
  return rows.map(({ foodId, amount, unit, ...e }) => ({
    ...e,
    portion: amount === null ? null : { foodId, amount, unit: unit! },
  }));
}

/**
 * Stores a nutrition snapshot. A portion records what was measured from a saved food.
 * @throws If the storage CHECK or foreign key constraints reject the values.
 */
export async function insertEntry(db: Db, e: EntryInput, portion: Portion | null = null): Promise<void> {
  await db.runAsync(
    `INSERT INTO diary_entries (day, label, calories, protein, carbs, fat, food_id, amount, unit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.day, e.label, e.calories, e.protein, e.carbs, e.fat, portion?.foodId ?? null, portion?.amount ?? null, portion?.unit ?? null],
  );
}

/**
 * Corrects an entry's label and nutrition. Its logged day and portion never change here.
 * @throws If the storage CHECK constraints reject the values.
 */
export async function updateEntry(db: Db, id: number, e: Omit<EntryInput, 'day'>): Promise<void> {
  await db.runAsync(
    'UPDATE diary_entries SET label = ?, calories = ?, protein = ?, carbs = ?, fat = ? WHERE id = ?',
    [e.label, e.calories, e.protein, e.carbs, e.fat, id],
  );
}

/** Permanently removes one entry. */
export async function deleteEntry(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM diary_entries WHERE id = ?', [id]);
}
