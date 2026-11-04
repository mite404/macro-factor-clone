import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { test } from 'node:test';

import { migrate } from '../../storage/migrations.ts';
import { openTestDb } from '../../storage/testDb.ts';
import {
  deleteWeight, insertWeight, listWeights, loadWeightUnit, parseWeight, saveWeightUnit, trend, updateWeight,
} from './weight.ts';

const at = (series: ReturnType<typeof trend>, day: string) => series.find((t) => t.day === day);

test('80 kg on day 1 and 82 kg on day 7 average 81 kg from two samples; day 8 drops day 1', () => {
  const series = trend([{ day: '2026-11-07', kg: 82 }, { day: '2026-11-01', kg: 80 }]);
  assert.deepEqual(at(series, '2026-11-07'), { day: '2026-11-07', kg: 81, samples: 2 });
  // Days between measurements still average what the window holds; nothing is interpolated.
  assert.deepEqual(at(series, '2026-11-04'), { day: '2026-11-04', kg: 80, samples: 1 });
  const withDay8 = trend([{ day: '2026-11-01', kg: 80 }, { day: '2026-11-07', kg: 82 }, { day: '2026-11-08', kg: 84 }]);
  assert.deepEqual(at(withDay8, '2026-11-08'), { day: '2026-11-08', kg: 83, samples: 2 });
});

test('no measurements give no trend, one gives one sample, and the trend stops at the last weigh-in', () => {
  assert.deepEqual(trend([]), []);
  assert.deepEqual(trend([{ day: '2026-11-04', kg: 70 }]), [{ day: '2026-11-04', kg: 70, samples: 1 }]);
  // A gap longer than the window has no trend on the days nothing falls inside it.
  const gap = trend([{ day: '2026-10-01', kg: 70 }, { day: '2026-10-20', kg: 72 }]);
  assert.equal(at(gap, '2026-10-07')?.samples, 1);
  assert.equal(at(gap, '2026-10-08'), undefined);
  assert.equal(gap.at(-1)?.day, '2026-10-20');
  // The window is calendar days, across a month end and the US DST change.
  const dst = trend([{ day: '2026-02-28', kg: 70 }, { day: '2026-03-06', kg: 71 }, { day: '2026-03-07', kg: 72 }]);
  assert.deepEqual(at(dst, '2026-03-06'), { day: '2026-03-06', kg: 70.5, samples: 2 });
  assert.deepEqual(at(dst, '2026-03-07'), { day: '2026-03-07', kg: 71.5, samples: 2 });
});

test('weights are entered in kg or lb, stored in kg without rounding, and must be above 0', () => {
  assert.deepEqual(parseWeight('100', 'lb'), { kg: 45.359237 });
  assert.deepEqual(parseWeight(' 80,5 ', 'kg'), { kg: 80.5 });
  for (const text of ['', '0', '-3', 'heavy']) assert.ok('error' in parseWeight(text, 'kg'), text);
});

test('one weigh-in per day: insert, explicit replace, delete, unit preference, and reopen', async () => {
  const path = `/tmp/weight-${process.pid}.db`;
  let opened = openTestDb(path);
  await migrate(opened.db);
  assert.deepEqual(await listWeights(opened.db), []);
  assert.equal(await loadWeightUnit(opened.db), 'kg');

  await insertWeight(opened.db, { day: '2026-11-07', kg: 45.359237 });
  await insertWeight(opened.db, { day: '2026-11-01', kg: 80 });
  await assert.rejects(insertWeight(opened.db, { day: '2026-11-01', kg: 81 }), /UNIQUE|PRIMARY KEY/);
  await updateWeight(opened.db, { day: '2026-11-01', kg: 79.5 });
  await saveWeightUnit(opened.db, 'lb');
  opened.close();
  opened = openTestDb(path);
  await migrate(opened.db);

  assert.deepEqual(JSON.parse(JSON.stringify(await listWeights(opened.db))),
    [{ day: '2026-11-01', kg: 79.5 }, { day: '2026-11-07', kg: 45.359237 }]);
  assert.equal(await loadWeightUnit(opened.db), 'lb');
  await deleteWeight(opened.db, '2026-11-01');
  assert.deepEqual(JSON.parse(JSON.stringify(await listWeights(opened.db))), [{ day: '2026-11-07', kg: 45.359237 }]);
  await assert.rejects(opened.db.runAsync("INSERT INTO weights (day, kg) VALUES ('2026-11-02', 0)", []), /CHECK/);
  await assert.rejects(opened.db.runAsync("INSERT INTO weights (day, kg) VALUES ('2026-11-02T08:00', 70)", []), /CHECK/);
  opened.close();
  rmSync(path, { force: true });
});
