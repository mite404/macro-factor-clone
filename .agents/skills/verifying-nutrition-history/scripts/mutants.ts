// Proves check.ts can fail: breaks real production lines one at a time, expects the named property
// to fail, restores the file. Refuses to run on a dirty src/.
// Usage: node .agents/skills/verifying-nutrition-history/scripts/mutants.ts
/// <reference types="node" />
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Mutant = { property: string; file: string; from: string; to: string; why: string };

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../../..');
const check = join(here, 'check.ts');
const foods = 'src/features/foods/foods.ts';
const diary = 'src/features/diary/diary.ts';
const storage = 'src/storage/migrations.ts';

const mutants: Mutant[] = [
  {
    property: 'H1 history-snapshot',
    why: 'editing a food recalculates past entries',
    file: foods,
    from: '    [...values(f), id],\n  );\n}',
    to: "    [...values(f), id],\n  );\n  await db.runAsync('UPDATE diary_entries SET calories = ? * amount / 100 WHERE food_id = ?', [f.calories, id]);\n}",
  },
  {
    property: 'H1 history-snapshot',
    why: 'archiving a food deletes its entries',
    file: foods,
    from: "  await db.runAsync('UPDATE foods SET archived = 1 WHERE id = ?', [id]);",
    to: "  await db.runAsync('DELETE FROM diary_entries WHERE food_id = ?', [id]);\n  await db.runAsync('UPDATE foods SET archived = 1 WHERE id = ?', [id]);",
  },
  {
    property: 'H2 unknown-stays-unknown',
    why: 'portion scaling turns unknown into 0',
    file: foods,
    from: '(value === null ? null : (value * factor) / 100)',
    to: '(((value ?? 0) * factor) / 100)',
  },
  {
    property: 'H2 unknown-stays-unknown',
    why: 'storing an entry writes unknown macros as 0',
    file: diary,
    from: '[e.day, e.label, e.calories, e.protein, e.carbs, e.fat,',
    to: '[e.day, e.label, e.calories, e.protein ?? 0, e.carbs ?? 0, e.fat ?? 0,',
  },
  {
    property: 'H3 portion-unit-and-day',
    why: 'correcting an entry clears its portion',
    file: diary,
    from: "'UPDATE diary_entries SET label = ?,",
    to: "'UPDATE diary_entries SET food_id = NULL, amount = NULL, unit = NULL, label = ?,",
  },
  {
    property: 'H3 portion-unit-and-day',
    why: 'a serving log records servings instead of the measured amount',
    file: foods,
    from: "portion: { foodId: food.id, amount, unit: food.basis },",
    to: "portion: { foodId: food.id, amount: quantity, unit: food.basis },",
  },
  {
    property: 'H4 unit-rejection',
    why: 'grams and millilitres convert 1:1',
    file: foods,
    from: "if (unit !== 'serving' && unit !== food.basis) {",
    to: 'if (false) {',
  },
  {
    property: 'F1 food-record-fidelity',
    why: 'barcodes lose leading zeros',
    file: foods,
    from: 'f.serving?.amount ?? null, f.barcode];',
    to: 'f.serving?.amount ?? null, f.barcode && String(Number(f.barcode))];',
  },
  {
    property: 'F2 archive-hides-only',
    why: 'search shows archived foods',
    file: foods,
    from: 'WHERE archived = 0 AND name LIKE',
    to: 'WHERE name LIKE',
  },
  {
    property: 'X0 no-error',
    why: 'reopening reruns applied migrations',
    file: storage,
    from: 'for (let version = current + 1;',
    to: 'for (let version = 1;',
  },
];

const runCheck = () => spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', check], { cwd: root, encoding: 'utf8' });

function main() {
  if (execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: root, encoding: 'utf8' }) !== '') {
    console.error('src/ has uncommitted changes; commit or stash them first');
    process.exit(2);
  }
  let missed = 0;
  for (const m of mutants) {
    const path = join(root, m.file);
    const original = readFileSync(path, 'utf8');
    if (original.split(m.from).length !== 2) {
      console.log(`STALE ${m.property} (${m.why}): target text not found once in ${m.file}`);
      missed++;
      continue;
    }
    let result;
    try {
      writeFileSync(path, original.replace(m.from, m.to));
      result = runCheck();
    } finally {
      writeFileSync(path, original);
    }
    const caught = result.status === 1 && result.stdout.startsWith(`FAIL ${m.property}`);
    if (!caught) missed++;
    console.log(`${caught ? 'CAUGHT' : 'MISSED'} ${m.property} (${m.why}) in ${m.file}`);
    console.log(result.stdout.trimEnd().replace(/^/gm, '    '));
  }
  const baseline = runCheck();
  const clean = execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: root, encoding: 'utf8' }) === '';
  console.log(`baseline after restore: ${baseline.stdout.split('\n')[0]}; src clean: ${clean}`);
  process.exit(missed === 0 && baseline.status === 0 && clean ? 0 : 1);
}

main();
