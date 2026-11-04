import type { Db } from '../../storage/migrations';
import { addDays, parseAmount } from '../diary/diary.ts';

// day is a local calendar date, YYYY-MM-DD, chosen by the user and never recomputed.
export type Weight = { day: string; kg: number };
export type WeightUnit = 'kg' | 'lb';
// The descriptive average of the weigh-ins in `day` and the six calendar days before it.
export type Trend = { day: string; kg: number; samples: number };

/** The international avoirdupois pound, exactly. */
export const KG_PER_LB = 0.45359237;
export const WINDOW_DAYS = 7;

/** Converts kilograms to the display unit. */
export const fromKg = (kg: number, unit: WeightUnit) => (unit === 'kg' ? kg : kg / KG_PER_LB);

/** Rounds to 0.1 in the display unit, as a scale shows it, e.g. "81 kg" or "176.4 lb". */
export const formatWeight = (kg: number, unit: WeightUnit) => `${Math.round(fromKg(kg, unit) * 10) / 10} ${unit}`;

/** Validates a weigh-in typed in `unit`; the result is kilograms, unrounded. */
export function parseWeight(text: string, unit: WeightUnit): { kg: number } | { error: string } {
  const value = parseAmount(text);
  if (value === null) return { error: 'Enter your weight' };
  if (value === undefined || value === 0) return { error: 'Enter a number above 0' };
  return { kg: unit === 'kg' ? value : value * KG_PER_LB };
}

/**
 * One point per calendar day from the first weigh-in to the last, for each day whose window holds
 * a weigh-in. Missing days count as absent, never 0, and nothing extends past the last weigh-in.
 */
export function trend(weights: readonly Weight[]): Trend[] {
  const sorted = [...weights].sort((a, b) => (a.day < b.day ? -1 : 1));
  const points: Trend[] = [];
  if (sorted.length === 0) return points;
  let start = 0;
  let end = 0;
  for (let day = sorted[0].day; day <= sorted.at(-1)!.day; day = addDays(day, 1)) {
    while (end < sorted.length && sorted[end].day <= day) end++;
    const from = addDays(day, 1 - WINDOW_DAYS);
    while (start < end && sorted[start].day < from) start++;
    const window = sorted.slice(start, end); // → at most 7 weigh-ins
    if (window.length > 0) points.push({ day, kg: window.reduce((sum, w) => sum + w.kg, 0) / window.length, samples: window.length });
  }
  return points;
}

/** Every weigh-in, oldest first. */
export async function listWeights(db: Db): Promise<Weight[]> {
  return db.getAllAsync<Weight>('SELECT day, kg FROM weights ORDER BY day', []);
}

/**
 * Records a weigh-in for a day that has none.
 * @throws If that day already has one; replacing it is an explicit `updateWeight`.
 */
export async function insertWeight(db: Db, w: Weight): Promise<void> {
  await db.runAsync('INSERT INTO weights (day, kg) VALUES (?, ?)', [w.day, w.kg]);
}

/** Replaces the weigh-in recorded for `w.day`. */
export async function updateWeight(db: Db, w: Weight): Promise<void> {
  await db.runAsync('UPDATE weights SET kg = ? WHERE day = ?', [w.kg, w.day]);
}

export async function deleteWeight(db: Db, day: string): Promise<void> {
  await db.runAsync('DELETE FROM weights WHERE day = ?', [day]);
}

/** The unit weights are entered and shown in; kg until the owner picks one. */
export async function loadWeightUnit(db: Db): Promise<WeightUnit> {
  const [row] = await db.getAllAsync<{ unit: WeightUnit }>('SELECT weight_unit AS unit FROM preferences', []);
  return row?.unit ?? 'kg';
}

export async function saveWeightUnit(db: Db, unit: WeightUnit): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO preferences (id, weight_unit) VALUES (1, ?)', [unit]);
}
