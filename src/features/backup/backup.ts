// The backup file format. docs/backup-format.md documents it and how later versions extend it.
import type { Db } from '../../storage/migrations';
import { addDays, type Unit } from '../diary/diary.ts';
import { NUTRIENTS, type Nutrient } from '../goals/goals.ts';

// Rows mirror the SQLite tables column for column: ids, explicit days, units, and null = unknown.
export type BackupFood = {
  id: number;
  name: string;
  basis: Unit;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  servingName: string | null;
  servingAmount: number | null;
  barcode: string | null;
  brand: string | null;
  sourceId: string | null;
  sourceName: string | null;
  retrievedOn: string | null;
  archived: boolean;
};
export type BackupEntry = {
  id: number;
  day: string;
  label: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  foodId: number | null;
  amount: number | null;
  unit: Unit | null;
};
export type BackupTarget = { nutrient: Nutrient; amount: number };
// parseBackup upgrades earlier versions to this shape, so restore handles only the current one.
export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  foods: BackupFood[];
  diaryEntries: BackupEntry[];
  targets: BackupTarget[];
};
export type BackupSummary = {
  foods: number;
  archivedFoods: number;
  entries: number;
  days: number;
  firstDay: string | null;
  lastDay: string | null;
  targets: number;
};

export const BACKUP_FORMAT = 'nutrition-diary-backup';
export const BACKUP_VERSION = 3;
/** Larger files are refused before they are read. Years of daily logging stay far below this. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const TOO_LARGE = 'This file is larger than 20 MB, too large for a backup.';

type Check = (value: unknown) => boolean;
const text: Check = (v) => typeof v === 'string';
const nonEmpty: Check = (v) => typeof v === 'string' && v !== '';
const amount: Check = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const positive: Check = (v) => amount(v) && (v as number) > 0;
const id: Check = (v) => Number.isSafeInteger(v) && (v as number) > 0;
const unit: Check = (v) => v === 'g' || v === 'ml';
const digits: Check = (v) => typeof v === 'string' && /^\d+$/.test(v);
// A real calendar date: 2026-02-30 is rejected because it does not survive date arithmetic.
const day: Check = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && addDays(v, 0) === v;
const orNull = (check: Check): Check => (v) => v === null || check(v);

// Field checks mirror the CHECK constraints in src/storage/migrations.ts.
const foodFields: Record<keyof BackupFood, Check> = {
  id, name: nonEmpty, basis: unit, calories: amount, protein: orNull(amount), carbs: orNull(amount), fat: orNull(amount),
  servingName: orNull(nonEmpty), servingAmount: orNull(positive), barcode: orNull(digits), brand: orNull(nonEmpty),
  sourceId: orNull(text), sourceName: orNull(text), retrievedOn: orNull(text), archived: (v) => typeof v === 'boolean',
};
const entryFields: Record<keyof BackupEntry, Check> = {
  id, day, label: text, calories: amount, protein: orNull(amount), carbs: orNull(amount), fat: orNull(amount),
  foodId: orNull(id), amount: orNull(positive), unit: orNull(unit),
};
const targetFields: Record<keyof BackupTarget, Check> = {
  nutrient: (v) => NUTRIENTS.some(([key]) => key === v), amount: positive,
};
// Collections each version holds. Version 1 predates targets.
const collections = (version: number) => ['foods', 'diaryEntries', ...(version >= 2 ? ['targets'] : [])];
// Food fields each version holds. Versions 1 and 2 predate brand.
const { brand: _, ...foodFieldsV1 } = foodFields;
const foodFieldsFor = (version: number): Record<string, Check> => (version >= 3 ? foodFields : foodFieldsV1);

const foodColumns = `id, name, basis, calories, protein, carbs, fat, serving_name AS servingName,
  serving_amount AS servingAmount, barcode, brand, source_id AS sourceId, source_name AS sourceName,
  retrieved_on AS retrievedOn, archived`;
const entryColumns = 'id, day, label, calories, protein, carbs, fat, food_id AS foodId, amount, unit';
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// The first problem in one collection's records, or null when every record is valid. `key` is unique.
function recordError(name: string, records: unknown[], fields: Record<string, Check>, key = 'id'): string | null {
  const seen = new Set<unknown>();
  for (const [index, record] of records.entries()) {
    if (!isObject(record)) return `${name} #${index + 1} is not a record`;
    const which = fields[key](record[key]) ? `${name} ${record[key]}` : `${name} #${index + 1}`;
    const extra = Object.keys(record).find((key) => !Object.hasOwn(fields, key));
    if (extra !== undefined) return `${which} has an unexpected field "${extra}"`;
    const invalid = Object.keys(fields).find((key) => !fields[key](record[key]));
    if (invalid !== undefined) return `${which} has an invalid value for ${invalid}`;
    if (seen.has(record[key])) return `${which} appears more than once`;
    seen.add(record[key]);
  }
  return null;
}

// The first reason the whole file cannot be restored, or null. Nothing is written before this passes.
function backupError(raw: unknown): string | null {
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) return 'This file is not a Nutrition diary backup.';
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1) return 'This backup has an unknown format version.';
  if ((raw.version as number) > BACKUP_VERSION) {
    return `This backup was made by a newer version of the app (format ${raw.version}). Update the app to restore it.`;
  }
  const expected = ['format', 'version', 'exportedAt', ...collections(raw.version as number)];
  const extra = Object.keys(raw).find((key) => !expected.includes(key));
  if (extra !== undefined) return `The backup has an unexpected field "${extra}".`;
  if (!text(raw.exportedAt)) return 'The backup has no export date.';
  for (const key of collections(raw.version as number)) if (!Array.isArray(raw[key])) return `The backup's ${key} is missing.`;
  const foods = raw.foods as BackupFood[];
  const entries = raw.diaryEntries as BackupEntry[];
  const problem = recordError('Food', foods, foodFieldsFor(raw.version as number)) ?? recordError('Diary entry', entries, entryFields)
    ?? recordError('Target', (raw.targets ?? []) as unknown[], targetFields, 'nutrient');
  if (problem) return `${problem}.`;
  const badFood = foods.find((f) => (f.servingName === null) !== (f.servingAmount === null));
  if (badFood) return `Food ${badFood.id} has a serving name without an amount, or an amount without a name.`;
  const badPortion = entries.find((e) => (e.amount === null) !== (e.unit === null));
  if (badPortion) return `Diary entry ${badPortion.id} has an amount without a unit, or a unit without an amount.`;
  const foodIds = new Set(foods.map((f) => f.id));
  const dangling = entries.find((e) => e.foodId !== null && !foodIds.has(e.foodId));
  if (dangling) return `Diary entry ${dangling.id} refers to food ${dangling.foodId}, which is not in the backup.`;
  return null;
}

/**
 * Reads every persisted user record. Credentials never live in SQLite, so none can be exported.
 * @param now The export time recorded in the file.
 */
export async function exportBackup(db: Db, now = new Date()): Promise<Backup> {
  const foods = await db.getAllAsync<Omit<BackupFood, 'archived'> & { archived: number }>(
    `SELECT ${foodColumns} FROM foods ORDER BY id`, [],
  ); // → rows with archived as 0 | 1
  const diaryEntries = await db.getAllAsync<BackupEntry>(`SELECT ${entryColumns} FROM diary_entries ORDER BY id`, []);
  const targets = await db.getAllAsync<BackupTarget>('SELECT nutrient, amount FROM targets ORDER BY nutrient', []);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    foods: foods.map((f) => ({ ...f, archived: f.archived === 1 })), // → BackupFood[]
    diaryEntries,
    targets,
  };
}

/**
 * Validates a whole backup file before anything is written. Rejects oversized and malformed files,
 * newer formats, invalid values, duplicate ids, and diary entries that refer to missing foods.
 * An earlier version is upgraded: collections it could not hold become empty, and fields null.
 */
export function parseBackup(json: string): { backup: Backup } | { error: string } {
  if (json.length > MAX_BACKUP_BYTES) return { error: TOO_LARGE };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: 'This file is not valid JSON, so it cannot be a backup.' };
  }
  const error = backupError(raw);
  if (error) return { error };
  const valid = raw as Omit<Backup, 'version' | 'targets' | 'foods'> & { targets?: BackupTarget[]; foods: Omit<BackupFood, 'brand'>[] };
  return {
    backup: {
      ...valid,
      version: BACKUP_VERSION,
      foods: valid.foods.map((f) => ({ brand: null, ...f })), // → BackupFood[]; a version 3 brand wins
      targets: valid.targets ?? [],
    },
  };
}

/** Counts what a backup holds, for the confirmation before it replaces anything. */
export function summarize(backup: Backup): BackupSummary {
  const days = [...new Set(backup.diaryEntries.map((e) => e.day))].sort();
  return {
    foods: backup.foods.length,
    archivedFoods: backup.foods.filter((f) => f.archived).length,
    entries: backup.diaryEntries.length,
    days: days.length,
    firstDay: days[0] ?? null,
    lastDay: days.at(-1) ?? null,
    targets: backup.targets.length,
  };
}

/**
 * Replaces all foods, diary entries, and targets with the backup's, in one transaction.
 * @throws If any write fails. The transaction rolls back, so the existing data stays.
 */
export async function restoreBackup(db: Db, backup: Backup): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.execAsync('DELETE FROM diary_entries; DELETE FROM foods; DELETE FROM targets;');
    for (const f of backup.foods) {
      await db.runAsync(
        `INSERT INTO foods (id, name, basis, calories, protein, carbs, fat, serving_name, serving_amount, barcode,
         brand, source_id, source_name, retrieved_on, archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [f.id, f.name, f.basis, f.calories, f.protein, f.carbs, f.fat, f.servingName, f.servingAmount, f.barcode,
          f.brand, f.sourceId, f.sourceName, f.retrievedOn, f.archived ? 1 : 0],
      );
    }
    for (const e of backup.diaryEntries) {
      await db.runAsync(
        `INSERT INTO diary_entries (id, day, label, calories, protein, carbs, fat, food_id, amount, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.id, e.day, e.label, e.calories, e.protein, e.carbs, e.fat, e.foodId, e.amount, e.unit],
      );
    }
    for (const t of backup.targets) {
      await db.runAsync('INSERT INTO targets (nutrient, amount) VALUES (?, ?)', [t.nutrient, t.amount]);
    }
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}
