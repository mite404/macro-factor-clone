import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { migrate, migrations } from '../../storage/migrations.ts';
import { openTestDb } from '../../storage/testDb.ts';
import { insertEntry, listEntries, updateEntry } from '../diary/diary.ts';
import {
  archiveFood,
  insertFood,
  logPortion,
  parseFoodForm,
  searchFoods,
  updateFood,
  type Food,
  type FoodForm,
} from './foods.ts';

const day = '2026-10-31';
const form = (fields: Partial<FoodForm>): FoodForm => ({
  name: 'Oats',
  basis: 'g',
  calories: '123',
  protein: '8',
  carbs: '',
  fat: '',
  servingName: '',
  servingAmount: '',
  barcode: '',
  ...fields,
});
function valid(fields: Partial<FoodForm>) {
  const result = parseFoodForm(form(fields));
  assert.ok('food' in result, JSON.stringify(result));
  return result.food;
}
async function save(db: Parameters<typeof insertFood>[0], fields: Partial<FoodForm>): Promise<Food> {
  const input = valid(fields);
  return { ...input, brand: null, source: null, id: await insertFood(db, input) };
}
async function log(db: Parameters<typeof insertFood>[0], food: Food, quantity: number, unit: Parameters<typeof logPortion>[2]) {
  const result = logPortion(food, quantity, unit);
  assert.ok('portion' in result, JSON.stringify(result));
  await insertEntry(db, { day, label: food.name, ...result.nutrition }, result.portion);
}

test('logs a gram portion as a snapshot that later food edits do not change', async () => {
  const { db, close } = openTestDb(':memory:');
  await migrate(db);
  const oats = await save(db, {});
  await log(db, oats, 150, 'g');

  await updateFood(db, oats.id, valid({ calories: '140' }));
  await log(db, (await searchFoods(db, 'oats'))[0], 100, 'g');

  const [first, second] = await listEntries(db, day);
  assert.deepEqual(
    { ...first },
    { id: first.id, day, label: 'Oats', calories: 184.5, protein: 12, carbs: null, fat: null, portion: { foodId: oats.id, amount: 150, unit: 'g' } },
  );
  assert.equal(second.calories, 140);

  // Correcting a diary entry changes neither the food nor the recorded portion.
  await updateEntry(db, first.id, { label: 'Morning oats', calories: 190, protein: 12, carbs: 30, fat: null });
  assert.deepEqual((await listEntries(db, day))[0].portion, { foodId: oats.id, amount: 150, unit: 'g' });
  assert.equal((await searchFoods(db, 'oats'))[0].calories, 140);
  close();
});

test('millilitres and grams never convert without food-specific data', async () => {
  const { db, close } = openTestDb(':memory:');
  await migrate(db);
  const juice = await save(db, { name: 'Orange juice', basis: 'ml', calories: '45', protein: '0.7', servingName: 'glass', servingAmount: '240' });

  await log(db, juice, 150, 'ml');
  assert.ok('error' in logPortion(juice, 150, 'g'), 'grams of a per-100-ml food');
  const oats = await save(db, {});
  assert.ok('error' in logPortion(oats, 150, 'ml'), 'millilitres of a per-100-g food');
  assert.ok('error' in logPortion(oats, 1, 'serving'), 'serving the food does not define');
  assert.ok('error' in logPortion(oats, 0, 'g'), 'zero amount');
  await log(db, juice, 1.5, 'serving');

  const entries = await listEntries(db, day);
  assert.deepEqual(entries.map((e) => [e.calories, e.portion?.amount, e.portion?.unit]), [
    [67.5, 150, 'ml'],
    [162, 360, 'ml'],
  ]);
  assert.equal(Math.round(entries[1].protein! * 100) / 100, 2.52);
  close();
});

test('rejects invalid foods and keeps unknown nutrients unknown', async () => {
  const { db, close } = openTestDb(':memory:');
  await migrate(db);
  assert.deepEqual(parseFoodForm(form({ servingName: 'scoop', servingAmount: '0' })), {
    errors: { servingAmount: 'Enter an amount above 0' },
  });
  assert.ok('errors' in parseFoodForm(form({ servingName: 'scoop' })), 'serving without amount');
  assert.ok('errors' in parseFoodForm(form({ servingAmount: '30' })), 'amount without serving name');
  assert.ok('errors' in parseFoodForm(form({ name: ' ' })), 'blank name');
  assert.ok('errors' in parseFoodForm(form({ barcode: '12 34' })), 'non-digit barcode');
  assert.deepEqual(parseFoodForm(form({ barcode: '0012345678906' })), { errors: { barcode: "The last digit doesn't match. Check each digit" } });
  const legacy = parseFoodForm(form({ barcode: '0070', calories: '140' }), '0070');
  assert.equal('food' in legacy && legacy.food.barcode, '0070', 'an unchanged pre-validation barcode saves as stored');
  assert.deepEqual(parseFoodForm(form({ barcode: '0071' }), '0070'), { errors: { barcode: 'A barcode has 8, 12, 13, or 14 digits' } });
  await assert.rejects(insertFood(db, { ...valid({}), serving: { name: 'scoop', amount: 0 } }));

  const bar = await save(db, { name: 'Protein bar', barcode: ' 0012345678905 ', protein: '', calories: '0' });
  assert.equal(bar.barcode, '0012345678905');
  await log(db, bar, 60, 'g');
  const [entry] = await listEntries(db, day);
  assert.deepEqual([entry.calories, entry.protein, entry.carbs], [0, null, null]);
  const [stored] = await searchFoods(db, 'bar');
  assert.deepEqual([stored.protein, stored.barcode], [null, '0012345678905']);
  await assert.rejects(insertEntry(db, { day, label: 'x', calories: 1, protein: null, carbs: null, fat: null }, { foodId: 999, amount: 1, unit: 'g' }), 'unknown food reference');
  close();
});

test('saved foods are found and logged offline after reopening; archived foods hide', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'foods-')), 'nutrition.db');
  let { db, close } = openTestDb(path);
  await migrate(db);
  const yogurt = await save(db, { name: 'Greek Yogurt 2%' });
  await save(db, { name: 'Oats' });
  await save(db, { name: '100% juice' });
  close();

  ({ db, close } = openTestDb(path));
  await migrate(db);
  assert.deepEqual((await searchFoods(db, 'yog')).map((f) => f.name), ['Greek Yogurt 2%']);
  assert.deepEqual((await searchFoods(db, '%')).map((f) => f.name), ['100% juice', 'Greek Yogurt 2%'], '% is literal');
  assert.deepEqual((await searchFoods(db, '')).map((f) => f.name), ['100% juice', 'Greek Yogurt 2%', 'Oats']);
  await log(db, (await searchFoods(db, 'greek'))[0], 200, 'g');

  await archiveFood(db, yogurt.id);
  assert.deepEqual(await searchFoods(db, 'yog'), []);
  assert.equal((await listEntries(db, day))[0].calories, 246, 'history survives archiving');
  close();
});

test('upgrading a ticket-01 database keeps its diary entries', async () => {
  const { db, close } = openTestDb(':memory:');
  await db.execAsync(`${migrations[0]}; PRAGMA user_version = 1;`);
  await db.runAsync("INSERT INTO diary_entries (day, label, calories, protein) VALUES (?, 'Old', 300, NULL)", [day]);
  await migrate(db);
  assert.deepEqual((await listEntries(db, day)).map((e) => ({ ...e })), [
    { id: 1, day, label: 'Old', calories: 300, protein: null, carbs: null, fat: null, portion: null },
  ]);
  close();
});
