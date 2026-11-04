// Bounded exhaustive check of diary-history integrity against the real app code and real SQLite.
// Usage: node .agents/skills/verifying-nutrition-history/scripts/check.ts [--depth N]
/// <reference types="node" />
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';

import { exportBackup, parseBackup, restoreBackup, type Backup } from '../../../../src/features/backup/backup.ts';
import { deleteEntry, insertEntry, listEntries, parseEntryForm, updateEntry, type Entry } from '../../../../src/features/diary/diary.ts';
import {
  archiveFood,
  insertFood,
  logPortion,
  parseFoodForm,
  searchFoods,
  updateFood,
  type Food,
  type FoodForm,
  type Provenance,
} from '../../../../src/features/foods/foods.ts';
import { loadTargets, parseTargets, saveTargets, type Targets } from '../../../../src/features/goals/goals.ts';
import { migrate, migrations, type Db } from '../../../../src/storage/migrations.ts';
import { openTestDb } from '../../../../src/storage/testDb.ts';

type Nut = { calories: number; protein: number | null; carbs: number | null; fat: number | null };
type Template = { form: FoodForm; per100: Nut; serving: { name: string; amount: number } | null; barcode: string | null };
// A saved food's brand and source are set when it is saved and no edit changes them.
type Slot = { id: number; t: Template; archived: boolean; provenance: Provenance } | null;
type ExpectedEntry = Omit<Entry, 'id'>;
type State = { slots: [Slot, Slot]; entries: ExpectedEntry[]; targets: Targets; saves: number; rejected: boolean };
type Op = { name: string; words: string; slot: 0 | 1; next: (s: State) => State | null };
type Failure = { property: string; detail: string };
class PropertyFailure extends Error {
  failure: Failure;
  constructor(failure: Failure) {
    super(failure.property);
    this.failure = failure;
  }
}

const DAY = '2026-10-31';
const depthArg = process.argv.indexOf('--depth');
const DEPTH = depthArg > 0 ? Number(process.argv[depthArg + 1]) : 4;
const SCRATCH = existsSync('/dev/shm') ? '/dev/shm' : tmpdir();

// Expected values are written by hand from the form text, not computed by the code under check.
// Blank means unknown (null); '0' means a known zero. Names are distinct so search order is total.
const blank = { protein: '', carbs: '', fat: '', servingName: '', servingAmount: '', barcode: '' };
const OATS: Template = {
  form: { ...blank, name: 'Oats', basis: 'g', calories: '123', protein: '8', fat: '0', servingName: 'cup', servingAmount: '40', barcode: ' 0036000291452 ' },
  per100: { calories: 123, protein: 8, carbs: null, fat: 0 },
  serving: { name: 'cup', amount: 40 },
  barcode: '0036000291452',
};
const JUICE: Template = {
  form: { ...blank, name: 'Juice', basis: 'ml', calories: '45', carbs: '10.4' },
  per100: { calories: 45, protein: null, carbs: 10.4, fat: null },
  serving: null,
  barcode: null,
};
const BAR: Template = {
  form: { ...blank, name: 'Bar', basis: 'g', calories: '0', servingName: 'bar', servingAmount: '60' },
  per100: { calories: 0, protein: null, carbs: null, fat: null },
  serving: { name: 'bar', amount: 60 },
  barcode: null,
};
const OAT_MILK: Template = {
  form: { ...blank, name: 'Oat milk', basis: 'ml', calories: '46', protein: '1', fat: '1.5', barcode: '012345678905' },
  per100: { calories: 46, protein: 1, carbs: null, fat: 1.5 },
  serving: null,
  barcode: '012345678905',
};
const RICE: Template = {
  form: { ...blank, name: 'Rice', basis: 'g', calories: '130', protein: '2.7', carbs: '28', fat: '0.3', servingName: 'bowl', servingAmount: '185' },
  per100: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  serving: { name: 'bowl', amount: 185 },
  barcode: null,
};
const MANUAL: Provenance = { brand: null, source: null };
const CORRECTION = { label: ' Fixed ', calories: '200', protein: '', carbs: '0', fat: '3,5' };
const CORRECTED = { label: 'Fixed', calories: 200, protein: null, carbs: 0, fat: 3.5 };
// Target forms as typed, and the one current set each must leave. Blank means no target.
const SET_TARGETS = { calories: '2000', protein: '100', carbs: '', fat: '' };
const EDIT_TARGETS = { calories: '', protein: ' 120 ', carbs: '', fat: '62,5' };
const LEGACY: ExpectedEntry = { day: DAY, label: 'Old', calories: 300, protein: null, carbs: 0, fat: null, portion: null };

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const live = (s: State, i: 0 | 1) => s.slots[i] !== null && !s.slots[i]!.archived;
const withSlot = (s: State, i: 0 | 1, slot: Slot): State => {
  const slots: [Slot, Slot] = [...s.slots];
  slots[i] = slot;
  return { ...s, slots, rejected: false };
};

// The spec oracle: the state the app must reach, or null when the UI cannot reach the op.
const save = (i: 0 | 1, t: Template, provenance = MANUAL) => (s: State) =>
  s.slots[i] === null ? { ...withSlot(s, i, { id: s.saves + 1, t, archived: false, provenance }), saves: s.saves + 1 } : null;
const edit = (i: 0 | 1, t: Template) => (s: State) => (live(s, i) ? withSlot(s, i, { ...s.slots[i]!, t }) : null);
const archive = (i: 0 | 1) => (s: State) => (live(s, i) ? withSlot(s, i, { ...s.slots[i]!, archived: true }) : null);
const log = (i: 0 | 1, quantity: number, unit: 'g' | 'ml' | 'serving') => (s: State) => {
  if (!live(s, i)) return null;
  const { id, t } = s.slots[i]!;
  if (unit === 'serving' ? !t.serving : unit !== t.form.basis) return { ...s, rejected: true };
  const amount = unit === 'serving' ? quantity * t.serving!.amount : quantity;
  const at = (v: number | null) => (v === null ? null : (v / 100) * amount);
  const entry: ExpectedEntry = {
    day: DAY,
    label: t.form.name,
    calories: at(t.per100.calories)!,
    protein: at(t.per100.protein),
    carbs: at(t.per100.carbs),
    fat: at(t.per100.fat),
    portion: { foodId: id, amount, unit: t.form.basis },
  };
  return { ...s, entries: [...s.entries, entry], rejected: false };
};
const ops: Op[] = [
  { name: 'save0', slot: 0, words: 'save Oats (per 100 g, carbs unknown, fat 0, cup = 40 g, barcode 0036000291452) as food 0', next: save(0, OATS) },
  { name: 'save1', slot: 1, words: 'save Juice (per 100 ml, protein and fat unknown, no serving) as food 1', next: save(1, JUICE) },
  { name: 'edit0Bar', slot: 0, words: 'edit food 0 to Bar (0 kcal, all macros unknown, bar = 60 g)', next: edit(0, BAR) },
  { name: 'edit0OatMilk', slot: 0, words: 'edit food 0 to Oat milk (basis g → ml, no serving)', next: edit(0, OAT_MILK) },
  { name: 'edit1Rice', slot: 1, words: 'edit food 1 to Rice (basis ml → g, bowl = 185 g)', next: edit(1, RICE) },
  { name: 'archive0', slot: 0, words: 'archive food 0', next: archive(0) },
  { name: 'archive1', slot: 1, words: 'archive food 1', next: archive(1) },
  { name: 'log0g', slot: 0, words: 'log 150 g of food 0', next: log(0, 150, 'g') },
  { name: 'log0ml', slot: 0, words: 'log 150 ml of food 0', next: log(0, 150, 'ml') },
  { name: 'log0serving', slot: 0, words: 'log 1.5 servings of food 0', next: log(0, 1.5, 'serving') },
  { name: 'log1ml', slot: 1, words: 'log 250 ml of food 1', next: log(1, 250, 'ml') },
  { name: 'log1serving', slot: 1, words: 'log 2 servings of food 1', next: log(1, 2, 'serving') },
  {
    name: 'correct', slot: 0, words: 'correct the first entry to "Fixed" 200 kcal, protein blank, carbs 0, fat 3,5',
    next: (s) => (s.entries.length ? { ...s, entries: [{ ...s.entries[0], ...CORRECTED }, ...s.entries.slice(1)], rejected: false } : null),
  },
  { name: 'delete', slot: 0, words: 'delete the first entry', next: (s) => (s.entries.length ? { ...s, entries: s.entries.slice(1), rejected: false } : null) },
  { name: 'reopen', slot: 0, words: 'close and reopen the database file, then migrate', next: (s) => ({ ...s, rejected: false }) },
  {
    name: 'restore', slot: 0, words: 'export a backup as JSON, parse it, restore it into a new database file, and use that file',
    next: (s) => ({ ...s, rejected: false }),
  },
  { name: 'setTargets', slot: 0, words: 'set targets: 2000 kcal and 100 g protein, carbs and fat blank', next: (s) => ({ ...s, targets: { calories: 2000, protein: 100 }, rejected: false }) },
  { name: 'editTargets', slot: 0, words: 'edit targets: calories blank, protein 120, fat 62,5', next: (s) => ({ ...s, targets: { protein: 120, fat: 62.5 }, rejected: false }) },
  {
    name: 'failedRestores', slot: 0,
    words: 'try to restore a backup whose entry refers to a missing food, then a valid backup whose middle write fails',
    next: (s) => ({ ...s, rejected: false }),
  },
];

function compareEntries(expected: ExpectedEntry[], actual: Entry[]): Failure | null {
  const detail = `expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual.map(({ id, ...e }) => e))}`;
  if (expected.length !== actual.length) return { property: 'H1 history-snapshot', detail };
  for (let i = 0; i < expected.length; i++) {
    const [e, a] = [expected[i], actual[i]];
    if ((['protein', 'carbs', 'fat'] as const).some((k) => (e[k] === null) !== (a[k] === null))) {
      return { property: 'H2 unknown-stays-unknown', detail };
    }
    if (!isDeepStrictEqual(e.portion, a.portion) || e.day !== a.day) return { property: 'H3 portion-unit-and-day', detail };
    const same = (k: keyof Nut) => (e[k] === null ? a[k] === null : near(e[k]!, a[k]!));
    if (!(['calories', 'protein', 'carbs', 'fat'] as const).every(same) || e.label !== a.label) {
      return { property: 'H1 history-snapshot', detail };
    }
  }
  return null;
}

function compareFoods(s: State, actual: Food[]): Failure | null {
  const expected = s.slots
    .filter((x): x is NonNullable<Slot> => x !== null && !x.archived)
    .map(({ id, t, provenance }): Food => ({ id, name: t.form.name, basis: t.form.basis, ...t.per100, serving: t.serving, barcode: t.barcode, ...provenance }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  if (isDeepStrictEqual(expected, actual.map((f) => ({ ...f })))) return null;
  const archived = s.slots.filter((x) => x?.archived).map((x) => x!.id);
  const detail = `expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`;
  return { property: actual.some((f) => archived.includes(f.id)) ? 'F2 archive-hides-only' : 'F1 food-record-fidelity', detail };
}

// Archived foods are hidden from search but must stay stored exactly as last saved. Read with SQL,
// not through the code under check.
async function compareArchived(db: Db, s: State): Promise<Failure | null> {
  const expected = s.slots
    .filter((x): x is NonNullable<Slot> => x !== null && x.archived)
    .map(({ id, t, provenance }) => ({ id, name: t.form.name, basis: t.form.basis, ...t.per100, serving: t.serving, barcode: t.barcode, ...provenance }))
    .sort((a, b) => a.id - b.id);
  type Row = Omit<Food, 'serving' | 'source'> & {
    servingName: string | null; servingAmount: number | null; sourceId: string | null; sourceName: string | null; retrievedOn: string | null;
  };
  const rows = await db.getAllAsync<Row>(
    `SELECT id, name, basis, calories, protein, carbs, fat, serving_name AS servingName, serving_amount AS servingAmount, barcode,
     brand, source_id AS sourceId, source_name AS sourceName, retrieved_on AS retrievedOn
     FROM foods WHERE archived = 1 ORDER BY id`, [],
  );
  const actual = rows.map(({ servingName, servingAmount, sourceId, sourceName, retrievedOn, ...f }) => ({
    ...f,
    serving: servingName === null ? null : { name: servingName, amount: servingAmount },
    source: sourceId === null ? null : { id: sourceId, name: sourceName, retrievedOn },
  }));
  if (isDeepStrictEqual(expected, actual)) return null;
  return { property: 'F3 archived-food-kept', detail: `expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}` };
}

async function compareTargets(db: Db, s: State): Promise<Failure | null> {
  const actual = { ...(await loadTargets(db)) };
  if (isDeepStrictEqual(s.targets, actual)) return null;
  return { property: 'T1 targets-current', detail: `expected ${JSON.stringify(s.targets)}\n  actual   ${JSON.stringify(actual)}` };
}

// Every stored row, read with SQL, so a failed restore can be compared with the data before it.
async function dump(db: Db): Promise<string> {
  const foods = await db.getAllAsync('SELECT * FROM foods ORDER BY id', []);
  const entries = await db.getAllAsync('SELECT * FROM diary_entries ORDER BY id', []);
  const targets = await db.getAllAsync('SELECT * FROM targets ORDER BY nutrient', []);
  return JSON.stringify({ foods, entries, targets });
}

// Both restores must fail and leave every row as it was: the bad file before any write, the good
// one by rolling back. Its delete and earlier inserts have run when the middle insert fails.
async function failedRestores(db: Db): Promise<void> {
  const before = await dump(db);
  const backup = await exportBackup(db);
  const fail = (detail: string) => {
    throw new PropertyFailure({ property: 'B1 failed-restore-changes-nothing', detail });
  };
  const dangling = { ...backup, diaryEntries: [...backup.diaryEntries, { ...extraEntry(backup), foodId: 999, amount: 1, unit: 'g' as const }] };
  if (!('error' in parseBackup(JSON.stringify(dangling)))) fail('a backup with an entry for missing food 999 was accepted');
  const valid = parseBackup(JSON.stringify({ ...backup, diaryEntries: [...backup.diaryEntries, extraEntry(backup)] }));
  if ('error' in valid) return fail(`a valid backup was rejected: ${valid.error}`);
  const middle = Math.ceil((valid.backup.foods.length + valid.backup.diaryEntries.length) / 2);
  let seen = 0;
  const failing: Db = {
    ...db,
    runAsync: async (sql, params) => {
      if (sql.trimStart().startsWith('INSERT') && ++seen === middle) throw new Error('injected write failure');
      return db.runAsync(sql, params);
    },
  };
  const outcome = await restoreBackup(failing, valid.backup).then(() => 'completed', (error) => String(error));
  if (outcome !== 'Error: injected write failure') fail(`restore with a failing middle write ${outcome === 'completed' ? 'completed' : `threw ${outcome}`}`);
  const after = await dump(db);
  if (after !== before) fail(`rows changed\n  before ${before}\n  after  ${after}`);
}

function extraEntry(backup: Backup) {
  const id = Math.max(0, ...backup.diaryEntries.map((e) => e.id)) + 1;
  return { id, day: DAY, label: 'Extra', calories: 1, protein: null, carbs: null, fat: null, foodId: null, amount: null, unit: null };
}

// Every op sequence of exactly `depth` the UI can reach.
function* sequences(s: State, depth: number, prefix: Op[] = []): Generator<Op[]> {
  if (prefix.length === depth) return yield prefix;
  for (const op of ops) {
    const next = op.next(s);
    if (next) yield* sequences(next, depth, [...prefix, op]);
  }
}

async function parsedFood(t: Template) {
  const parsed = parseFoodForm(t.form);
  if ('errors' in parsed) throw new Error(`valid food form rejected: ${JSON.stringify(parsed.errors)}`);
  return parsed.food;
}

// Drives the real code the way Diary.tsx and BackupSettings.tsx do. Returns whether logPortion rejected.
async function apply(db: Db, op: Op, before: State, after: State): Promise<boolean> {
  const slot = before.slots[op.slot] ?? after.slots[op.slot];
  if (op.name === 'setTargets' || op.name === 'editTargets') {
    const parsed = parseTargets(op.name === 'setTargets' ? SET_TARGETS : EDIT_TARGETS);
    if ('errors' in parsed) throw new Error(`valid targets rejected: ${JSON.stringify(parsed.errors)}`);
    await saveTargets(db, parsed.targets);
  } else if (op.name.startsWith('save')) {
    const id = await insertFood(db, await parsedFood(after.slots[op.slot]!.t));
    if (id !== slot!.id) throw new Error(`insertFood returned id ${id}, expected ${slot!.id}`);
  } else if (op.name.startsWith('edit')) {
    await updateFood(db, slot!.id, await parsedFood(after.slots[op.slot]!.t));
  } else if (op.name.startsWith('archive')) {
    await archiveFood(db, slot!.id);
  } else if (op.name.startsWith('log')) {
    const food = (await searchFoods(db, '')).find((f) => f.id === slot!.id);
    if (!food) return true;
    const unit = op.name.endsWith('serving') ? 'serving' : op.name.endsWith('ml') ? 'ml' : 'g';
    const quantity = { log0serving: 1.5, log1serving: 2, log1ml: 250 }[op.name] ?? 150;
    const result = logPortion(food, quantity, unit);
    if ('error' in result) return true;
    await insertEntry(db, { day: DAY, label: food.name, ...result.nutrition }, result.portion);
  } else if (op.name === 'correct') {
    const parsed = parseEntryForm(CORRECTION, DAY);
    if ('errors' in parsed) throw new Error(`valid correction rejected: ${JSON.stringify(parsed.errors)}`);
    await updateEntry(db, (await listEntries(db, DAY))[0].id, parsed.entry);
  } else if (op.name === 'delete') {
    await deleteEntry(db, (await listEntries(db, DAY))[0].id);
  } else if (op.name === 'failedRestores') {
    await failedRestores(db);
  }
  return false;
}

async function run(legacy: boolean, seq: Op[]): Promise<{ failure: Failure; steps: number } | null> {
  const dir = mkdtempSync(join(SCRATCH, 'nutrition-check-'));
  let path = join(dir, 'nutrition.db');
  let { db, close } = openTestDb(path);
  let s: State = { slots: [null, null], entries: legacy ? [LEGACY] : [], targets: {}, saves: 0, rejected: false };
  let step = 0;
  try {
    if (legacy) {
      await db.execAsync(`${migrations[0]}; PRAGMA user_version = 1;`);
      await db.runAsync("INSERT INTO diary_entries (day, label, calories, protein, carbs, fat) VALUES (?, 'Old', 300, NULL, 0, NULL)", [DAY]);
    }
    await migrate(db);
    for (; step < seq.length; step++) {
      const op = seq[step];
      const next = op.next(s)!;
      if (op.name === 'reopen') {
        close();
        ({ db, close } = openTestDb(path));
        await migrate(db);
      }
      if (op.name === 'restore') {
        const parsed = parseBackup(JSON.stringify(await exportBackup(db)));
        if ('error' in parsed) throw new Error(`own backup rejected: ${parsed.error}`);
        close();
        path = join(dir, `restored-${step}.db`);
        ({ db, close } = openTestDb(path));
        await migrate(db);
        await restoreBackup(db, parsed.backup);
      }
      const rejected = await apply(db, op, s, next);
      s = next;
      const failure =
        rejected !== s.rejected
          ? { property: 'H4 unit-rejection', detail: `logPortion ${rejected ? 'rejected' : 'accepted'}; the spec says ${s.rejected ? 'reject' : 'accept'}` }
          : (compareEntries(s.entries, await listEntries(db, DAY)) ?? compareFoods(s, await searchFoods(db, '')) ??
            (await compareArchived(db, s)) ?? (await compareTargets(db, s)));
      if (failure) return { failure, steps: step + 1 };
    }
    return null;
  } catch (error) {
    if (error instanceof PropertyFailure) return { failure: error.failure, steps: step + 1 };
    return { failure: { property: 'X0 no-error', detail: String(error) }, steps: step + 1 };
  } finally {
    close();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const probe = new DatabaseSync(':memory:');
  const { v } = probe.prepare('SELECT sqlite_version() AS v').get() as { v: string };
  probe.close();
  const started = Date.now();
  let runs = 0;
  // Iterative deepening, so the first counterexample is a shortest one.
  for (let depth = 1; depth <= DEPTH; depth++) {
    for (const legacy of [false, true]) {
      const start: State = { slots: [null, null], entries: legacy ? [LEGACY] : [], targets: {}, saves: 0, rejected: false };
      for (const seq of sequences(start, depth)) {
        runs++;
        const result = await run(legacy, seq);
        if (!result) continue;
        console.log(`FAIL ${result.failure.property}`);
        console.log(`start: ${legacy ? 'ticket-01 database with entry "Old" 300 kcal, protein unknown, carbs 0, fat unknown; migrate' : 'empty database; migrate'}`);
        console.log(seq.slice(0, result.steps).map((op, i) => `  ${i + 1}. ${op.words}`).join('\n'));
        console.log(`  ${result.failure.detail}`);
        process.exit(1);
      }
    }
  }
  console.log(`PASS H1 H2 H3 H4 F1 F2 F3 T1 B1 X0: ${runs} sequences of 1-${DEPTH} ops from ${ops.length}, 2 start states`);
  console.log(`node ${process.version}, SQLite ${v}, ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

await main();
