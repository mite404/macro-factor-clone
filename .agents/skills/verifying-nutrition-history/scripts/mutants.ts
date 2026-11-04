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
const backup = 'src/features/backup/backup.ts';
const goals = 'src/features/goals/goals.ts';
const lookup = 'src/features/lookup/lookup.ts';

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
    property: 'F3 archived-food-kept',
    why: 'a backup leaves out archived foods',
    file: backup,
    from: '`SELECT ${foodColumns} FROM foods ORDER BY id`',
    to: '`SELECT ${foodColumns} FROM foods WHERE archived = 0 ORDER BY id`',
  },
  {
    property: 'H2 unknown-stays-unknown',
    why: 'restore writes unknown macros as 0',
    file: backup,
    from: '[e.id, e.day, e.label, e.calories, e.protein, e.carbs, e.fat,',
    to: '[e.id, e.day, e.label, e.calories, e.protein ?? 0, e.carbs ?? 0, e.fat ?? 0,',
  },
  {
    property: 'H3 portion-unit-and-day',
    why: 'restore drops portions',
    file: backup,
    from: 'e.foodId, e.amount, e.unit],',
    to: 'null, null, null],',
  },
  {
    property: 'B1 failed-restore-changes-nothing',
    why: 'validation accepts an entry for a missing food',
    file: backup,
    from: '  if (dangling) return',
    to: '  if (false) return',
  },
  {
    property: 'B1 failed-restore-changes-nothing',
    why: 'a failed restore commits its earlier writes',
    file: backup,
    from: "    await db.execAsync('ROLLBACK');",
    to: "    await db.execAsync('COMMIT');",
  },
  {
    property: 'H1 history-snapshot',
    why: 'saving targets clears the diary',
    file: goals,
    from: "await db.execAsync('DELETE FROM targets');",
    to: "await db.execAsync('DELETE FROM targets; DELETE FROM diary_entries;');",
  },
  {
    property: 'T1 targets-current',
    why: 'the targets form drops the carbs and fat fields',
    file: goals,
    from: 'for (const [key] of NUTRIENTS) {',
    to: 'for (const [key] of NUTRIENTS.slice(0, 2)) {',
  },
  {
    property: 'T1 targets-current',
    why: 'restore skips the first target',
    file: backup,
    from: 'for (const t of backup.targets) {',
    to: 'for (const t of backup.targets.slice(1)) {',
  },
  {
    property: 'T1 targets-current',
    why: 'a backup leaves out targets',
    file: backup,
    from: "'SELECT nutrient, amount FROM targets ORDER BY nutrient'",
    to: "'SELECT nutrient, amount FROM targets WHERE 0'",
  },
  {
    property: 'F1 food-record-fidelity',
    why: 'a top-ranked USDA record with another GTIN counts as a match',
    file: lookup,
    from: "return 'gtin' in code && code.gtin === gtin;\n  });\n  if (exact.length === 0)",
    to: "return 'gtin' in code;\n  });\n  if (exact.length === 0)",
  },
  {
    property: 'F1 food-record-fidelity',
    why: 'restore drops the brand',
    file: backup,
    from: 'f.brand, f.sourceId,',
    to: 'null, f.sourceId,',
  },
  {
    property: 'L1 saved-barcode-offline',
    why: 'barcode lookup returns archived foods',
    file: foods,
    from: 'FROM foods WHERE archived = 0 AND barcode IS NOT NULL',
    to: 'FROM foods WHERE barcode IS NOT NULL',
  },
  {
    property: 'L1 saved-barcode-offline',
    why: 'saved barcodes compare as typed digits, so another GTIN length misses',
    file: foods,
    from: "return 'gtin' in code && code.gtin === gtin;\n  }).map(toFood);",
    to: "return row.barcode === gtin;\n  }).map(toFood);",
  },
  {
    property: 'F1 food-record-fidelity',
    why: 'an Open Food Facts gap is filled from another record in the reply',
    file: lookup,
    from: 'if (!isObject(n) || n.source_index !== energy.source_index || n.modifier !== undefined) return null;',
    to: 'if (!isObject(n) || n.modifier !== undefined) return null;',
  },
  {
    property: 'F1 food-record-fidelity',
    why: "Open Food Facts' net carbohydrates are saved as total carbs",
    file: lookup,
    from: "off: 'carbohydrates-total'",
    to: "off: 'carbohydrates'",
  },
  {
    property: 'F1 food-record-fidelity',
    why: 'a lookup with no USDA key never asks Open Food Facts, so nothing can be imported',
    file: lookup,
    from: "if (usda.kind !== 'not-found' && usda.kind !== 'missing-key') return usda;",
    to: "if (usda.kind !== 'not-found') return usda;",
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
