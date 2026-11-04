import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { test } from 'node:test';

import { migrate } from '../../storage/migrations.ts';
import { openTestDb } from '../../storage/testDb.ts';
import { dayTotals, insertEntry, listEntries, type Nutrition } from '../diary/diary.ts';
import { compareTargets, loadTargets, parseTargets, saveTargets } from './goals.ts';

const blank = { calories: '', protein: '', carbs: '', fat: '' };
const entry = (n: Partial<Nutrition>): Nutrition => ({ calories: 0, protein: 0, carbs: 0, fat: 0, ...n });
const rows = (targets: Parameters<typeof compareTargets>[0], entries: Nutrition[]) =>
  compareTargets(targets, dayTotals(entries), entries.length);

test('targets are optional, independent, positive, and finite', () => {
  assert.deepEqual(parseTargets(blank), { targets: {} });
  // No 4/4/9 reconciliation: 2000 kcal with 300 g protein alone is accepted as entered.
  assert.deepEqual(parseTargets({ ...blank, calories: '2000', protein: ' 300 ' }), { targets: { calories: 2000, protein: 300 } });
  assert.deepEqual(parseTargets({ ...blank, fat: '62,5' }), { targets: { fat: 62.5 } });
  const bad = parseTargets({ calories: '0', protein: '-5', carbs: 'lots', fat: '9'.repeat(400) });
  assert.ok('errors' in bad);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['calories', 'carbs', 'fat', 'protein']);
});

test('no targets compares nothing, so nothing divides by zero or invents a goal', () => {
  assert.deepEqual(rows({}, []), []);
  assert.deepEqual(rows({}, [entry({ calories: 500 })]), []);
});

test('2150 kcal against a 2000 kcal target reads 150 kcal over, not 0 left', () => {
  const [calories] = rows({ calories: 2000 }, [entry({ calories: 1400 }), entry({ calories: 750 })]);
  assert.deepEqual(calories, { nutrient: 'calories', name: 'Calories', amount: '2150 of 2000 kcal', status: '150 kcal over', fill: 1, over: true, incomplete: false });
});

test('under, reached, and an empty day against a target', () => {
  assert.equal(rows({ protein: 100 }, [entry({ protein: 62.25 })])[0].status, '37.8 g left');
  assert.equal(rows({ protein: 100 }, [entry({ protein: 62.25 })])[0].fill, 0.6225);
  assert.equal(rows({ carbs: 200 }, [entry({ carbs: 200 })])[0].status, 'target reached');
  assert.deepEqual(rows({ fat: 70 }, [])[0], { nutrient: 'fat', name: 'Fat', amount: '0 of 70 g', status: '70 g left', fill: 0, over: false, incomplete: false });
});

test('unknown intake is never shown as complete or as an amount left', () => {
  const partial = rows({ protein: 100 }, [entry({ protein: 40 }), entry({ protein: null })])[0];
  assert.deepEqual(partial, { nutrient: 'protein', name: 'Protein', amount: 'at least 40 of 100 g', status: 'incomplete: 1 entry has unknown protein', fill: 0.4, over: false, incomplete: true });
  // Known intake alone already passes the target, so it is over by at least that much.
  const overFloor = rows({ protein: 100 }, [entry({ protein: 130 }), entry({ protein: null })])[0];
  assert.equal(overFloor.status, 'at least 30 g over; incomplete: 1 entry has unknown protein');
  assert.equal(overFloor.over, true);
  const unknown = rows({ fat: 70 }, [entry({ fat: null }), entry({ fat: null })])[0];
  assert.equal(unknown.amount, 'unknown of 70 g');
  assert.equal(unknown.status, 'incomplete: 2 entries have unknown fat');
});

test('rows follow the diary order and skip unset targets', () => {
  const names = rows({ carbs: 250, calories: 2000, fat: 70 }, []).map((r) => r.nutrient);
  assert.deepEqual(names, ['calories', 'fat', 'carbs']);
});

test('one current target set is saved, replaced, cleared, and leaves diary snapshots alone', async () => {
  const path = `/tmp/goals-${process.pid}.db`;
  let opened = openTestDb(path);
  await migrate(opened.db);
  assert.deepEqual(await loadTargets(opened.db), {});
  await insertEntry(opened.db, { day: '2026-11-03', label: 'Oats', calories: 2150, protein: null, carbs: 30, fat: 0 });
  const before = await listEntries(opened.db, '2026-11-03');

  await saveTargets(opened.db, { calories: 2000, protein: 100 });
  await saveTargets(opened.db, { protein: 120, fat: 70 });
  opened.close();
  opened = openTestDb(path);
  await migrate(opened.db);

  assert.deepEqual({ ...(await loadTargets(opened.db)) }, { protein: 120, fat: 70 });
  assert.deepEqual(await listEntries(opened.db, '2026-11-03'), before);
  await saveTargets(opened.db, {});
  assert.deepEqual(await loadTargets(opened.db), {});
  await assert.rejects(opened.db.runAsync("INSERT INTO targets (nutrient, amount) VALUES ('fiber', 30)", []), /CHECK/);
  await assert.rejects(opened.db.runAsync("INSERT INTO targets (nutrient, amount) VALUES ('fat', 0)", []), /CHECK/);
  opened.close();
  rmSync(path, { force: true });
});
