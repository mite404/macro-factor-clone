import type { Db } from '../../storage/migrations';
import { parseAmount, parseNutrition, type Nutrition, type NutritionForm, type Portion, type Unit } from '../diary/diary.ts';

// Nutrition is per 100 of basis. A serving is a named, measured amount in that same unit.
export type FoodInput = Nutrition & {
  name: string;
  basis: Unit;
  serving: { name: string; amount: number } | null;
  barcode: string | null; // digits as text; leading zeros are meaningful
};
// Where an imported food came from. Manual foods have none, and edits never change it.
export type Source = { id: string; name: string; retrievedOn: string };
export type Provenance = { brand: string | null; source: Source | null };
export type Food = FoodInput & Provenance & { id: number };
// A valid GTIN-8, -12 (UPC-A), -13 (EAN), or -14, right-aligned to 14 digits. Every shorter form
// of one product pads to the same 14 digits; different products never do.
export type Gtin = string & { readonly gtin: unique symbol };

export type FoodForm = NutritionForm & {
  name: string;
  basis: Unit;
  servingName: string;
  servingAmount: string;
  barcode: string;
};
export type FoodFormErrors = Partial<Record<keyof FoodForm, string>>;

const columns = `id, name, basis, calories, protein, carbs, fat,
  serving_name AS servingName, serving_amount AS servingAmount, barcode, brand,
  source_id AS sourceId, source_name AS sourceName, retrieved_on AS retrievedOn`;
const manual: Provenance = { brand: null, source: null };
const scale = (value: number | null, factor: number) => (value === null ? null : (value * factor) / 100);

/**
 * Validates typed barcode digits, ignoring spaces and hyphens, including the GS1 check digit.
 * ponytail: an 8-digit code is read as EAN-8; expand UPC-E when the camera (ticket 07) reports it.
 */
export function parseGtin(text: string): { gtin: Gtin; digits: string } | { error: string } {
  const digits = text.replace(/[\s-]/g, '');
  if (digits === '') return { error: 'Enter the digits under the barcode' };
  if (!/^\d+$/.test(digits)) return { error: 'Use digits only' };
  if (![8, 12, 13, 14].includes(digits.length)) return { error: 'A barcode has 8, 12, 13, or 14 digits' };
  const gtin = digits.padStart(14, '0');
  // GS1: weight 3 and 1 alternate from the digit left of the check digit.
  const sum = gtin.slice(0, 13).split('').reduce((total, d, i) => total + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  if ((10 - (sum % 10)) % 10 !== Number(gtin[13])) return { error: "The last digit doesn't match. Check each digit" };
  return { gtin: gtin as Gtin, digits };
}

/**
 * Validates food form text at the input boundary.
 * @param saved The edited food's stored barcode, kept as is while unchanged even if it predates GTIN checks.
 */
export function parseFoodForm(form: FoodForm, saved: string | null = null): { food: FoodInput } | { errors: FoodFormErrors } {
  const nutrition = parseNutrition(form);
  const errors: FoodFormErrors = 'errors' in nutrition ? { ...nutrition.errors } : {};
  const name = form.name.trim();
  if (name === '') errors.name = 'Name is required';
  const servingName = form.servingName.trim();
  const servingAmount = parseAmount(form.servingAmount);
  if (servingAmount === undefined || servingAmount === 0) errors.servingAmount = 'Enter an amount above 0';
  else if (servingName === '' && servingAmount !== null) errors.servingName = 'Name this serving';
  else if (servingName !== '' && servingAmount === null) errors.servingAmount = `Enter its amount in ${form.basis}`;
  const barcode = form.barcode.trim();
  const code = barcode === '' ? null : barcode === saved ? { digits: saved } : parseGtin(barcode);
  if (code && 'error' in code) errors.barcode = code.error;
  if (Object.keys(errors).length > 0 || 'errors' in nutrition) return { errors };
  return {
    food: {
      name,
      basis: form.basis,
      ...nutrition.nutrition,
      serving: servingAmount ? { name: servingName, amount: servingAmount } : null,
      barcode: code && 'digits' in code ? code.digits : null,
    },
  };
}

/**
 * Snapshots `quantity` of a food, in its basis unit or in servings, as diary nutrition.
 * Grams and millilitres never convert into each other: that needs density data a food lacks.
 */
export function logPortion(
  food: Food,
  quantity: number,
  unit: Unit | 'serving',
): { nutrition: Nutrition; portion: Portion } | { error: string } {
  if (!(quantity > 0 && Number.isFinite(quantity))) return { error: 'Enter an amount above 0' };
  if (unit === 'serving' && !food.serving) return { error: `${food.name} has no serving size` };
  if (unit !== 'serving' && unit !== food.basis) {
    return { error: `${food.name} is measured per 100 ${food.basis}; it has no ${unit} conversion` };
  }
  const amount = unit === 'serving' ? quantity * food.serving!.amount : quantity;
  return {
    nutrition: {
      calories: scale(food.calories, amount)!,
      protein: scale(food.protein, amount),
      carbs: scale(food.carbs, amount),
      fat: scale(food.fat, amount),
    },
    portion: { foodId: food.id, amount, unit: food.basis },
  };
}

type FoodRow = Omit<Food, 'serving' | 'source'> & {
  servingName: string | null; servingAmount: number | null; sourceId: string | null; sourceName: string | null;
  retrievedOn: string | null;
};
// The schema keeps serving name and amount set together; imports and restores set all three source fields.
const toFood = ({ servingName, servingAmount, sourceId, sourceName, retrievedOn, ...food }: FoodRow): Food => ({
  ...food,
  serving: servingName === null ? null : { name: servingName, amount: servingAmount! },
  source: sourceId === null ? null : { id: sourceId, name: sourceName!, retrievedOn: retrievedOn! },
});

/** Saved, unarchived foods whose name contains `query` (case-insensitive), by name. Local only. */
export async function searchFoods(db: Db, query: string): Promise<Food[]> {
  const rows = await db.getAllAsync<FoodRow>(
    `SELECT ${columns} FROM foods
     WHERE archived = 0 AND name LIKE ? ESCAPE '\\'
     ORDER BY name COLLATE NOCASE LIMIT 100`,
    [`%${query.trim().replace(/[\\%_]/g, '\\$&')}%`],
  );
  return rows.map(toFood);
}

/** Saved, unarchived foods whose barcode is the same product as `gtin`, in any GTIN length. Local only. */
export async function findFoodsByBarcode(db: Db, gtin: Gtin): Promise<Food[]> {
  const rows = await db.getAllAsync<FoodRow>(
    `SELECT ${columns} FROM foods WHERE archived = 0 AND barcode IS NOT NULL ORDER BY id`, [],
  ); // → FoodRow[] with any stored digits, including pre-validation ones such as "0070"
  return rows.filter((row) => {
    const code = parseGtin(row.barcode!);
    return 'gtin' in code && code.gtin === gtin;
  }).map(toFood);
}

function values(f: FoodInput) {
  return [f.name, f.basis, f.calories, f.protein, f.carbs, f.fat, f.serving?.name ?? null, f.serving?.amount ?? null, f.barcode];
}

/**
 * @param provenance An import's brand and source; a manual food has neither.
 * @returns The new food's id.
 * @throws If the storage CHECK constraints reject the values.
 */
export async function insertFood(db: Db, f: FoodInput, { brand, source }: Provenance = manual): Promise<number> {
  const { lastInsertRowId } = await db.runAsync(
    `INSERT INTO foods (name, basis, calories, protein, carbs, fat, serving_name, serving_amount, barcode,
     brand, source_id, source_name, retrieved_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...values(f), brand, source?.id ?? null, source?.name ?? null, source?.retrievedOn ?? null],
  );
  return lastInsertRowId;
}

/**
 * Changes how the food logs from now on. Diary entries keep their snapshots; brand and source are untouched.
 * @throws If the storage CHECK constraints reject the values.
 */
export async function updateFood(db: Db, id: number, f: FoodInput): Promise<void> {
  await db.runAsync(
    `UPDATE foods SET name = ?, basis = ?, calories = ?, protein = ?, carbs = ?, fat = ?,
     serving_name = ?, serving_amount = ?, barcode = ? WHERE id = ?`,
    [...values(f), id],
  );
}

/** Hides a food from search. Diary entries logged from it stay as they are. */
export async function archiveFood(db: Db, id: number): Promise<void> {
  await db.runAsync('UPDATE foods SET archived = 1 WHERE id = ?', [id]);
}
