import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { migrate } from '../../storage/migrations.ts';
import { openTestDb as open } from '../../storage/testDb.ts';
import {
  addDays,
  dayTotals,
  deleteEntry,
  insertEntry,
  listEntries,
  localDay,
  parseEntryForm,
  updateEntry,
  type EntryForm,
} from './diary.ts';

const day = '2026-10-31';
const form = (fields: Partial<EntryForm>): EntryForm => ({
  label: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  ...fields,
});
function valid(fields: Partial<EntryForm>) {
  const result = parseEntryForm(form(fields), day);
  assert.ok('entry' in result, JSON.stringify(result));
  return result.entry;
}

test('logs, edits, deletes, and survives reopening the database', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'diary-')), 'nutrition.db');
  let { db, close } = open(path);
  await migrate(db);

  await insertEntry(db, valid({ label: 'Yogurt', calories: '240', protein: '17', carbs: '23', fat: '9' }));
  await insertEntry(db, valid({ label: 'Apple', calories: '80' }));
  await insertEntry(db, { ...valid({ calories: '999' }), day: addDays(day, 1) });

  let totals = dayTotals(await listEntries(db, day));
  assert.equal(totals.calories, 320);
  assert.deepEqual(totals.protein, { grams: 17, missing: 1 });
  assert.deepEqual(totals.fat, { grams: 9, missing: 1 });

  const [yogurt, apple] = await listEntries(db, day);
  // Regression: saving an edit while viewing another day must not move the entry.
  const draftFromOtherDay = { ...yogurt, day: addDays(day, -1), calories: 200 };
  await updateEntry(db, yogurt.id, draftFromOtherDay);
  assert.equal(dayTotals(await listEntries(db, day)).calories, 280);
  await deleteEntry(db, apple.id);
  totals = dayTotals(await listEntries(db, day));
  assert.equal(totals.calories, 200);
  assert.deepEqual(totals.carbs, { grams: 23, missing: 0 });

  close();
  ({ db, close } = open(path));
  await migrate(db); // idempotent on an up-to-date database
  assert.deepEqual(
    (await listEntries(db, day)).map((e) => ({ ...e })),
    [{ id: yogurt.id, day, label: 'Yogurt', calories: 200, protein: 17, carbs: 23, fat: 9, portion: null }],
  );
  close();
});

test('rejects negative and non-finite values without adding a row', async () => {
  const { db, close } = open(':memory:');
  await migrate(db);
  for (const bad of ['-5', 'Infinity', 'NaN', '1e3', '9'.repeat(400), '1-2']) {
    const result = parseEntryForm(form({ calories: '10', fat: bad }), day);
    assert.deepEqual(result, { errors: { fat: 'Enter a number of 0 or more' } }, bad);
  }
  assert.ok('errors' in parseEntryForm(form({ calories: '' }), day), 'calories are required');
  await assert.rejects(insertEntry(db, { ...valid({ calories: '1' }), calories: -1 }));
  assert.deepEqual(await listEntries(db, day), []);
  assert.deepEqual(valid({ calories: '0', protein: '0', carbs: '2,5' }), {
    day,
    label: 'Quick add',
    calories: 0,
    protein: 0,
    carbs: 2.5,
    fat: null,
  });
  close();
});

test('calendar days ignore timezone and DST changes', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    assert.equal(addDays('2026-11-01', 1), '2026-11-02'); // 25-hour DST day
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(localDay(new Date(2026, 9, 31, 23, 30)), '2026-10-31');
    process.env.TZ = 'Asia/Tokyo';
    assert.equal(addDays('2026-11-01', 1), '2026-11-02');
  } finally {
    process.env.TZ = previous;
  }
});
