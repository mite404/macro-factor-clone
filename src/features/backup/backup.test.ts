import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { migrate, type Db } from '../../storage/migrations.ts';
import { openTestDb } from '../../storage/testDb.ts';
import { insertEntry, listEntries } from '../diary/diary.ts';
import { archiveFood, insertFood, searchFoods } from '../foods/foods.ts';
import { loadTargets, saveTargets } from '../goals/goals.ts';
import { insertRecipe, listRecipes } from '../recipes/recipes.ts';
import { insertWeight, listWeights, loadWeightUnit, saveWeightUnit } from '../weight/weight.ts';
import { exportBackup, MAX_BACKUP_BYTES, parseBackup, restoreBackup, summarize, type Backup } from './backup.ts';

// The first shipped format. Later versions must keep restoring this file unchanged.
const v1Text = readFileSync(new URL('./backup-v1.json', import.meta.url), 'utf8');
const v1 = JSON.parse(v1Text);
const v2Text = readFileSync(new URL('./backup-v2.json', import.meta.url), 'utf8');
const v2 = JSON.parse(v2Text);
const v3Text = readFileSync(new URL('./backup-v3.json', import.meta.url), 'utf8');
const v3 = JSON.parse(v3Text);
const v4Text = readFileSync(new URL('./backup-v4.json', import.meta.url), 'utf8');
const v4 = JSON.parse(v4Text);
const v5Text = readFileSync(new URL('./backup-v5.json', import.meta.url), 'utf8');
const v5 = JSON.parse(v5Text);
// Versions 1-3 predate recipes, so they restore with none.
const noRecipes = { recipes: [], recipeIngredients: [] };
// Versions 1-4 predate weights, so they restore with none, shown in kg.
const noWeights = { weights: [], weightUnit: 'kg' };
// Versions 1 and 2 predate brand, so their foods restore without one.
const unbranded = (backup: { foods: object[] }) => backup.foods.map((f) => ({ ...f, brand: null }));

async function emptyDb() {
  const opened = openTestDb(':memory:');
  await migrate(opened.db);
  return opened;
}

function parsed(text: string): Backup {
  const result = parseBackup(text);
  assert.ok('backup' in result, JSON.stringify(result));
  return result.backup;
}

function rejected(value: unknown): string {
  const result = parseBackup(typeof value === 'string' ? value : JSON.stringify(value));
  assert.ok('error' in result, 'expected the backup to be rejected');
  return result.error;
}

// Existing data that every failed restore must leave exactly as it was.
async function seeded() {
  const { db, close } = await emptyDb();
  const foodId = await insertFood(db, { name: 'Rice', basis: 'g', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, serving: null, barcode: null });
  await insertEntry(db, { day: '2026-11-02', label: 'Rice', calories: 260, protein: 5.4, carbs: 56, fat: 0.6 }, { foodId, amount: 200, unit: 'g' });
  await saveTargets(db, { calories: 1800, fat: 60 });
  await insertWeight(db, { day: '2026-11-02', kg: 90 });
  await saveWeightUnit(db, 'lb');
  return { db, close, before: await exportBackup(db) };
}

// node:sqlite rows have a null prototype; compare them as the plain JSON a file holds.
const records = ({ foods, diaryEntries, targets, recipes, recipeIngredients, weights, weightUnit }: Backup) =>
  JSON.parse(JSON.stringify({ foods, diaryEntries, targets, recipes, recipeIngredients, weights, weightUnit }));

test('a backup of two days and saved foods restores every record into an empty database', async () => {
  const source = await emptyDb();
  const oats = await insertFood(source.db, { name: 'Oats', basis: 'g', calories: 379, protein: 13.2, carbs: null, fat: 0, serving: { name: 'cup', amount: 40 }, barcode: '0070' });
  const juice = await insertFood(source.db, { name: 'Juice', basis: 'ml', calories: 45, protein: null, carbs: 10.4, fat: null, serving: null, barcode: '0012345678905' },
    { brand: 'Sunny Grove', source: { id: 'fdc:2345', name: 'USDA FoodData Central', retrievedOn: '2026-10-20' } });
  await insertEntry(source.db, { day: '2026-10-30', label: 'Quick add', calories: 250, protein: 0, carbs: null, fat: null });
  await insertEntry(source.db, { day: '2026-10-31', label: 'Oats', calories: 568.5, protein: 19.8, carbs: null, fat: 0 }, { foodId: oats, amount: 150, unit: 'g' });
  await insertEntry(source.db, { day: '2026-10-31', label: 'Juice', calories: 148.5, protein: null, carbs: 34.32, fat: null }, { foodId: juice, amount: 330, unit: 'ml' });
  await archiveFood(source.db, juice);
  await saveTargets(source.db, { calories: 2000, protein: 100, fat: 62.5 });
  await insertWeight(source.db, { day: '2026-10-31', kg: 45.359237 });
  await saveWeightUnit(source.db, 'lb');
  await insertRecipe(source.db, { name: 'Porridge', finishedGrams: 250, ingredients: [
    { foodId: oats, name: 'Oats', grams: 80, serving: { name: 'cup', count: 2 }, calories: 379, protein: 13.2, carbs: null, fat: 0 },
  ] });
  const backup = await exportBackup(source.db, new Date('2026-11-01T14:05:00Z'));

  const target = await emptyDb();
  await restoreBackup(target.db, parsed(JSON.stringify(backup)));

  assert.deepEqual(await exportBackup(target.db, new Date('2026-11-01T14:05:00Z')), backup);
  for (const day of ['2026-10-30', '2026-10-31']) {
    assert.deepEqual(await listEntries(target.db, day), await listEntries(source.db, day));
  }
  assert.deepEqual(await searchFoods(target.db, ''), await searchFoods(source.db, ''));
  assert.deepEqual(await listRecipes(target.db), await listRecipes(source.db));
  assert.deepEqual(await listWeights(target.db), await listWeights(source.db));
  assert.equal(await loadWeightUnit(target.db), 'lb');
  assert.equal(backup.recipeIngredients.length, 1);
  assert.deepEqual({ ...(await loadTargets(target.db)) }, { calories: 2000, protein: 100, fat: 62.5 });
  assert.equal(backup.foods.find((f) => f.id === juice)?.archived, true);
  source.close();
  target.close();
});

test('the first backup format restores with nulls, zeros, units, ids, and archived foods intact', async () => {
  const { db, close } = await seeded();
  await restoreBackup(db, parsed(v1Text));

  // Version 1 predates targets, so restoring it leaves no targets rather than keeping the old ones.
  assert.deepEqual(records(await exportBackup(db)), { ...records(v1), foods: unbranded(v1), targets: [], ...noRecipes, ...noWeights });
  assert.deepEqual(await loadTargets(db), {});
  assert.deepEqual(await listEntries(db, '2026-11-02'), []);
  assert.deepEqual(summarize(parsed(v1Text)), { foods: 2, archivedFoods: 1, entries: 3, days: 2, firstDay: '2026-10-30', lastDay: '2026-10-31', targets: 0, recipes: 0, weights: 0 });
  close();
});

test('the version 2 format restores its targets with the same records', async () => {
  const { db, close } = await seeded();
  await restoreBackup(db, parsed(v2Text));

  assert.deepEqual(records(await exportBackup(db)), { ...records(v2), foods: unbranded(v2), ...noRecipes, ...noWeights });
  assert.deepEqual({ ...(await loadTargets(db)) }, { calories: 2000, protein: 100 });
  assert.equal(summarize(parsed(v2Text)).targets, 2);
  close();
});

test('the version 3 format restores an imported food with its brand, barcode, and source', async () => {
  const { db, close } = await seeded();
  await restoreBackup(db, parsed(v3Text));

  assert.deepEqual(records(await exportBackup(db)), { ...records(v3), ...noRecipes, ...noWeights });
  const [imported] = await searchFoods(db, 'berry');
  assert.deepEqual([imported.brand, imported.barcode, { ...imported.source }],
    ["KAR'S", '077034085228', { id: 'fdc:2105222', name: 'USDA FoodData Central', retrievedOn: '2026-11-04' }]);
  close();
});

test('the version 4 format restores recipe snapshots, units, yield, and the portion logged from one', async () => {
  const { db, close } = await seeded();
  await restoreBackup(db, parsed(v4Text));

  assert.deepEqual(records(await exportBackup(db)), { ...records(v4), ...noWeights });
  const [recipe] = await listRecipes(db);
  assert.deepEqual(JSON.parse(JSON.stringify(recipe)), {
    id: 3, name: 'Trail oats', finishedGrams: 200,
    ingredients: [
      { foodId: 1, name: 'Oats', grams: 80, serving: { name: 'cup', count: 2 }, calories: 370, protein: 13.2, carbs: null, fat: 0 },
      { foodId: 5, name: "NUT 'N BERRY MIX", grams: 56, serving: null, calories: 500, protein: 14.3, carbs: 42.9, fat: 32.1 },
    ],
  });
  // The snapshot keeps 370 kcal although the saved food now says 379.
  assert.equal((await searchFoods(db, 'oats'))[0].calories, 379);
  const [entry] = await listEntries(db, '2026-11-03');
  assert.deepEqual([entry.label, entry.calories, entry.carbs, { ...entry.portion }], ['Trail oats', 288, null, { foodId: null, amount: 100, unit: 'g' }]);
  assert.equal(summarize(parsed(v4Text)).recipes, 1);
  close();
});

test('the version 5 format restores weigh-ins in kg, unrounded, and the unit they are shown in', async () => {
  const { db, close } = await seeded();
  await restoreBackup(db, parsed(v5Text));

  assert.deepEqual(records(await exportBackup(db)), records(v5));
  assert.deepEqual(JSON.parse(JSON.stringify(await listWeights(db))), v5.weights);
  assert.equal(await loadWeightUnit(db), 'lb');
  assert.equal(summarize(parsed(v5Text)).weights, 3);
  // An earlier file replaces the weigh-ins with none and the unit with the kg default.
  await restoreBackup(db, parsed(v4Text));
  assert.deepEqual(await listWeights(db), []);
  assert.equal(await loadWeightUnit(db), 'kg');
  close();
});

test('rejects unreadable, future, and inconsistent backups with a reason', () => {
  const withFood = (patch: object) => ({ ...v1, foods: [{ ...v1.foods[0], ...patch }, v1.foods[1]] });
  const withSource = (patch: object) => ({ ...v3, foods: v3.foods.map((f: { id: number }) => (f.id === 4 ? { ...f, ...patch } : f)) });
  const withEntry = (patch: object) => ({ ...v1, diaryEntries: [...v1.diaryEntries.slice(0, 2), { ...v1.diaryEntries[2], ...patch }] });
  const cases: [string, unknown, RegExp][] = [
    ['malformed JSON', v1Text.slice(0, -10), /not valid JSON/],
    ['another app', { ...v1, format: 'other' }, /not a Nutrition diary backup/],
    ['future version', { ...v5, version: 6 }, /newer version of the app \(format 6\)/],
    ['weights in version 4', { ...v4, weights: [] }, /unexpected field "weights"/],
    ['version 5 without weights', { ...v5, weights: undefined }, /weights is missing/],
    ['unknown weight unit', { ...v5, weightUnit: 'stone' }, /weight unit/],
    ['version 5 without a weight unit', { ...v5, weightUnit: undefined }, /weight unit/],
    ['two weigh-ins on one day', { ...v5, weights: [v5.weights[0], { ...v5.weights[0], kg: 81 }] }, /Weigh-in 2026-11-01 appears more than once/],
    ['zero weight', { ...v5, weights: [{ ...v5.weights[0], kg: 0 }] }, /Weigh-in 2026-11-01 has an invalid value for kg/],
    ['weigh-in timestamp', { ...v5, weights: [{ ...v5.weights[0], day: '2026-11-01T08:00:00Z' }] }, /Weigh-in #1 has an invalid value for day/],
    ['weight in pounds', { ...v5, weights: [{ ...v5.weights[0], lb: 176 }] }, /Weigh-in 2026-11-01 has an unexpected field "lb"/],
    ['recipes in version 3', { ...v3, recipes: [] }, /unexpected field "recipes"/],
    ['version 4 without ingredients', { ...v4, recipeIngredients: undefined }, /recipeIngredients is missing/],
    ['zero finished weight', { ...v4, recipes: [{ ...v4.recipes[0], finishedGrams: 0 }] }, /Recipe 3 has an invalid value for finishedGrams/],
    ['ingredient in millilitres', { ...v4, recipeIngredients: [{ ...v4.recipeIngredients[0], unit: 'ml' }, v4.recipeIngredients[1]] }, /Recipe ingredient 6 has an unexpected field "unit"/],
    ['servings without a name', { ...v4, recipeIngredients: [{ ...v4.recipeIngredients[0], servingName: null }, v4.recipeIngredients[1]] }, /Recipe ingredient 6 has a serving count without a name/],
    ['ingredient of a missing recipe', { ...v4, recipeIngredients: [v4.recipeIngredients[0], { ...v4.recipeIngredients[1], recipeId: 4 }] }, /Recipe ingredient 8 refers to recipe 4/],
    ['ingredient of a missing food', { ...v4, recipeIngredients: [v4.recipeIngredients[0], { ...v4.recipeIngredients[1], foodId: 2 }] }, /Recipe ingredient 8 refers to food 2/],
    ['recipe without ingredients', { ...v4, recipes: [...v4.recipes, { id: 9, name: 'Empty', finishedGrams: 100 }] }, /Recipe 9 has no ingredients/],
    ['brand in version 2', { ...v2, foods: [{ ...v2.foods[0], brand: 'Acme' }] }, /Food 1 has an unexpected field "brand"/],
    ['version 3 without brand', { ...v3, foods: [{ ...v3.foods[0], brand: undefined }] }, /Food 1 has an invalid value for brand/],
    ['empty brand', { ...v3, foods: [{ ...v3.foods[0], brand: '' }] }, /Food 1 has an invalid value for brand/],
    ['targets in version 1', { ...v1, targets: [] }, /unexpected field "targets"/],
    ['version 2 without targets', { ...v2, targets: undefined }, /targets is missing/],
    ['unknown nutrient', { ...v2, targets: [{ nutrient: 'fiber', amount: 30 }] }, /Target #1 has an invalid value for nutrient/],
    ['zero target', { ...v2, targets: [{ nutrient: 'fat', amount: 0 }] }, /Target fat has an invalid value for amount/],
    ['target written as text', { ...v2, targets: [{ nutrient: 'calories', amount: '2000' }] }, /Target calories has an invalid value for amount/],
    ['duplicate target', { ...v2, targets: [v2.targets[0], { ...v2.targets[0], amount: 1800 }] }, /Target calories appears more than once/],
    ['unexpected target field', { ...v2, targets: [{ ...v2.targets[0], day: '2026-11-01' }] }, /Target calories has an unexpected field "day"/],
    ['fractional version', { ...v1, version: 0.5 }, /unknown format version/],
    ['missing collection', { ...v1, foods: undefined }, /foods is missing/],
    ['dangling food reference', withEntry({ foodId: 3 }), /Diary entry 9 refers to food 3, which is not in the backup/],
    ['duplicate food id', { ...v1, foods: [v1.foods[0], { ...v1.foods[1], id: 1 }] }, /Food 1 appears more than once/],
    ['duplicate entry id', withEntry({ id: 7 }), /Diary entry 7 appears more than once/],
    ['negative calories', withFood({ calories: -1 }), /Food 1 has an invalid value for calories/],
    ['zero written as text', withFood({ fat: '0' }), /Food 1 has an invalid value for fat/],
    ['unknown unit', withEntry({ unit: 'oz' }), /Diary entry 9 has an invalid value for unit/],
    ['amount without unit', withEntry({ unit: null }), /Diary entry 9 has an amount without a unit/],
    ['serving without amount', withFood({ servingAmount: null }), /Food 1 has a serving name without an amount/],
    ['source without name', withSource({ sourceName: null }), /Food 4 has a source id, name, and date that are not all set/],
    ['source without date', withSource({ retrievedOn: null }), /Food 4 has a source id, name, and date that are not all set/],
    ['source with empty name', withSource({ sourceName: '' }), /Food 4 has an invalid value for sourceName/],
    ['impossible date', withEntry({ day: '2026-02-30' }), /Diary entry 9 has an invalid value for day/],
    ['non-digit barcode', withFood({ barcode: '12a' }), /Food 1 has an invalid value for barcode/],
    ['missing field', withFood({ archived: undefined }), /Food 1 has an invalid value for archived/],
    ['unexpected field', withFood({ password: 'x' }), /Food 1 has an unexpected field "password"/],
    // JSON.parse makes these own keys; an `in` check would mistake them for inherited schema fields.
    ['inherited name constructor', withFood({ constructor: 1 }), /Food 1 has an unexpected field "constructor"/],
    ['inherited name toString', withEntry({ toString: 'x' }), /Diary entry 9 has an unexpected field "toString"/],
    ['inherited name __proto__', withFood(JSON.parse('{"__proto__": {}}')), /Food 1 has an unexpected field "__proto__"/],
  ];
  for (const [name, value, reason] of cases) assert.match(rejected(value), reason, name);
  assert.match(rejected(' '.repeat(MAX_BACKUP_BYTES + 1)), /larger than 20 MB/);
});

test('a write that fails halfway through restore rolls back to the existing data', async () => {
  const { db, close, before } = await seeded();
  let inserts = 0;
  const failing: Db = {
    ...db,
    runAsync: async (sql, params) => {
      if (sql.startsWith('INSERT') && ++inserts === 3) throw new Error('disk I/O error');
      return db.runAsync(sql, params);
    },
  };

  await assert.rejects(restoreBackup(failing, parsed(v1Text)), /disk I\/O error/);

  assert.equal(inserts, 3);
  assert.deepEqual(await exportBackup(db, new Date(before.exportedAt)), before);
  await restoreBackup(db, parsed(v1Text));
  assert.deepEqual(records(await exportBackup(db)), { ...records(v1), foods: unbranded(v1), targets: [], ...noRecipes, ...noWeights });
  close();
});

test('storage constraints roll back a restore that skipped validation', async () => {
  const { db, close, before } = await seeded();
  const unchecked = { ...v2, diaryEntries: [{ ...v1.diaryEntries[1], foodId: 99 }] } as Backup;

  await assert.rejects(restoreBackup(db, unchecked), /FOREIGN KEY/);

  assert.deepEqual(await exportBackup(db, new Date(before.exportedAt)), before);
  close();
});
