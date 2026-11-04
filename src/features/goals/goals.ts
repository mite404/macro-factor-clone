import type { Db } from '../../storage/migrations';
import { parseAmount, type DayTotals, type NutritionForm } from '../diary/diary.ts';

// The one current target set. A nutrient without a target is absent, never 0.
export type Nutrient = keyof NutritionForm;
export type Targets = Partial<Record<Nutrient, number>>;
export type TargetErrors = Partial<Record<Nutrient, string>>;
// One diary progress row; `fill` is consumed / target, capped at 1, for a bar beside the text.
export type TargetRow = {
  nutrient: Nutrient;
  name: string;
  amount: string;
  status: string;
  fill: number;
  over: boolean;
  incomplete: boolean;
};

// The diary's Macros order.
export const NUTRIENTS = [
  ['calories', 'Calories', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['fat', 'Fat', 'g'],
  ['carbs', 'Carbs', 'g'],
] as const;

const round = (n: number) => Math.round(n * 10) / 10;

/** Validates the targets form. Blank leaves a nutrient without a target; values must be above 0. */
export function parseTargets(form: NutritionForm): { targets: Targets } | { errors: TargetErrors } {
  const targets: Targets = {};
  const errors: TargetErrors = {};
  for (const [key] of NUTRIENTS) {
    const value = parseAmount(form[key]);
    if (value === null) continue;
    if (value === undefined || value === 0) errors[key] = 'Enter a number above 0, or leave it blank';
    else targets[key] = value;
  }
  return Object.keys(errors).length > 0 ? { errors } : { targets };
}

/**
 * Compares a day's totals with the current targets, one row per set target. A sum that omits
 * unknown values is a floor: it can prove a target exceeded, never an amount left.
 */
export function compareTargets(targets: Targets, totals: DayTotals, entries: number): TargetRow[] {
  return NUTRIENTS.filter(([key]) => targets[key] !== undefined).map(([key, name, unit]) => {
    const target = targets[key]!;
    const { consumed, missing } = key === 'calories' ? { consumed: totals.calories, missing: 0 }
      : { consumed: totals[key].grams, missing: totals[key].missing };
    // Rounded as a magnitude: Math.round(-377.5) is -377, which would show 37.75 left as 37.7.
    const gap = round(Math.abs(consumed - target));
    const over = consumed > target && gap > 0;
    const unknown = missing > 0 ? `incomplete: ${missing} ${missing === 1 ? 'entry has' : 'entries have'} unknown ${name.toLowerCase()}` : '';
    const amount = missing > 0 && missing === entries ? 'unknown' : `${missing > 0 ? 'at least ' : ''}${round(consumed)}`;
    const status = over ? `${missing > 0 ? 'at least ' : ''}${gap} ${unit} over${unknown && `; ${unknown}`}`
      : unknown || (gap === 0 ? 'target reached' : `${gap} ${unit} left`);
    return { nutrient: key, name, amount: `${amount} of ${round(target)} ${unit}`, status,
      fill: Math.min(consumed / target, 1), over, incomplete: missing > 0 };
  });
}

/** The current targets; nutrients without one are absent. */
export async function loadTargets(db: Db): Promise<Targets> {
  const rows = await db.getAllAsync<{ nutrient: Nutrient; amount: number }>('SELECT nutrient, amount FROM targets', []);
  return Object.fromEntries(rows.map((r) => [r.nutrient, r.amount]));
}

/**
 * Replaces the current target set in one transaction. Diary entries are never touched.
 * @throws If the storage CHECK constraints reject a value (rolled back).
 */
export async function saveTargets(db: Db, targets: Targets): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.execAsync('DELETE FROM targets');
    for (const [nutrient, amount] of Object.entries(targets)) {
      await db.runAsync('INSERT INTO targets (nutrient, amount) VALUES (?, ?)', [nutrient, amount]);
    }
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}
