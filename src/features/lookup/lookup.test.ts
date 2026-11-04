import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { migrate } from '../../storage/migrations.ts';
import { openTestDb } from '../../storage/testDb.ts';
import { insertEntry, listEntries, localDay } from '../diary/diary.ts';
import { archiveFood, insertFood, logPortion, parseGtin, updateFood } from '../foods/foods.ts';
import { lookupBarcode, USDA_SOURCE, USDA_TIMEOUT_MS, type Lookup } from './lookup.ts';

// Unmodified FoodData Central search responses, recorded 2026-11-04 for these barcodes.
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./usda-search-${name}.json`, import.meta.url), 'utf8'));
const kars = fixture('kars').foods[0]; // gtinUpc "077034085228", 500 kcal per 100 g
const cheerios = fixture('cheerios').foods[0]; // gtinUpc "00016000275287", conflicting duplicate nutrients

const key = async () => 'fixture-key';
const noKey = async () => null;
const respond = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
const unreachable = async () => assert.fail('no request expected') as never;
const keyUnread = async () => assert.fail('no key read expected') as never;

async function emptyDb() {
  const opened = openTestDb(':memory:');
  await migrate(opened.db);
  return opened;
}

function usda(result: Lookup) {
  assert.equal(result.kind, 'usda', JSON.stringify(result));
  return (result as Extract<Lookup, { kind: 'usda' }>).foods;
}

test('validates check digits and pads every GTIN length to the same 14 digits', () => {
  const gtin = (text: string) => {
    const result = parseGtin(text);
    assert.ok('gtin' in result, `${text}: ${JSON.stringify(result)}`);
    return result.gtin;
  };
  // Wikipedia's UPC-A, EAN-13, and EAN-8 examples, whose check digits are published.
  assert.equal(gtin('036000291452'), '00036000291452');
  assert.equal(gtin('0036000291452'), '00036000291452');
  assert.equal(gtin('00036000291452'), '00036000291452');
  assert.equal(gtin(' 0 36000-29145 2 '), '00036000291452');
  assert.equal(gtin('4006381333931'), '04006381333931');
  assert.equal(gtin('96385074'), '00000096385074');
  assert.deepEqual(parseGtin('036000291453'), { error: "The last digit doesn't match. Check each digit" });
  assert.deepEqual(parseGtin('36000291452'), { error: 'A barcode has 8, 12, 13, or 14 digits' }, 'a dropped leading zero is not padded back');
  assert.deepEqual(parseGtin('03600029145a'), { error: 'Use digits only' });
  assert.deepEqual(parseGtin(''), { error: 'Enter the digits under the barcode' });
});

test('a saved barcode is found in any equivalent form with no key read or request', async () => {
  const { db, close } = await emptyDb();
  const id = await insertFood(db, { name: 'Cola', basis: 'ml', calories: 42, protein: 0, carbs: 10.6, fat: 0, serving: null, barcode: '036000291452' });
  await insertFood(db, { name: 'Pencil', basis: 'g', calories: 1, protein: null, carbs: null, fat: null, serving: null, barcode: '4006381333931' });
  await insertFood(db, { name: 'Old code', basis: 'g', calories: 1, protein: null, carbs: null, fat: null, serving: null, barcode: '0070' });

  for (const typed of ['036000291452', '0036000291452', '00036000291452']) {
    const result = await lookupBarcode(db, typed, keyUnread, unreachable);
    assert.equal(result.kind, 'saved');
    assert.deepEqual((result as Extract<Lookup, { kind: 'saved' }>).foods.map((f) => f.id), [id], typed);
  }
  assert.deepEqual(await lookupBarcode(db, '036000291453', keyUnread, unreachable), { kind: 'invalid', error: "The last digit doesn't match. Check each digit" });

  await archiveFood(db, id);
  assert.deepEqual(await lookupBarcode(db, '036000291452', noKey, unreachable), { kind: 'missing-key' }, 'archived foods are hidden');
  close();
});

test('only a record whose own gtinUpc is the same GTIN matches, whatever its rank', async () => {
  const { db, close } = await emptyDb();
  let url = '';
  let init: RequestInit | undefined;
  const top = { ...kars, fdcId: 1, gtinUpc: '77034085228', description: 'Missing leading zero' };
  const result = await lookupBarcode(db, '0077034085228', key, async (input, options) => {
    url = String(input);
    init = options;
    return new Response(JSON.stringify({ foods: [cheerios, top, kars] }));
  });

  assert.deepEqual(usda(result).map((f) => ({ ...f })), [{
    name: "NUT 'N BERRY MIX", basis: 'g', calories: 500, protein: 14.3, carbs: 42.9, fat: 32.1, barcode: '0077034085228',
    serving: { name: '1 ONZ', amount: 28 }, brand: "KAR'S",
    source: { id: 'fdc:2105222', name: USDA_SOURCE, retrievedOn: localDay() }, published: '2021-10-28',
  }]);
  const query = new URL(url).searchParams;
  assert.equal(query.get('query'), '077034085228 0077034085228 00077034085228');
  assert.equal(query.get('dataType'), 'Branded');
  assert.ok(!url.includes('fixture-key'), 'the key stays out of the URL');
  assert.deepEqual(init?.headers, { 'X-Api-Key': 'fixture-key' });

  assert.deepEqual(await lookupBarcode(db, '077034085228', key, respond({ foods: [cheerios, top] })), { kind: 'not-found' });
  assert.deepEqual(await lookupBarcode(db, '077034085228', key, respond({ totalHits: 0, foods: [] })), { kind: 'not-found' });
  close();
});

test('several exact records are all offered; unusable nutrition is skipped, never zeroed', async () => {
  const { db, close } = await emptyDb();
  const reformulated = { ...kars, fdcId: 999, gtinUpc: '00077034085228' };
  assert.deepEqual(usda(await lookupBarcode(db, '077034085228', key, respond({ foods: [kars, reformulated] }))).map((f) => f.source.id),
    ['fdc:2105222', 'fdc:999']);

  const without = (...ids: number[]) => kars.foodNutrients.filter((n: { nutrientId: number }) => !ids.includes(n.nutrientId));
  const [caloriesOnly] = usda(await lookupBarcode(db, '077034085228', key, respond({ foods: [{ ...kars, foodNutrients: without(1003, 1004, 1005) }] })));
  assert.deepEqual([caloriesOnly.calories, caloriesOnly.protein, caloriesOnly.carbs, caloriesOnly.fat], [500, null, null, null], 'missing macros are unknown');

  const negative = { ...kars, fdcId: 7, foodNutrients: [...without(1003), { nutrientId: 1003, unitName: 'G', value: -1 }] };
  assert.deepEqual(await lookupBarcode(db, '077034085228', key, respond({ foods: [kars, negative] })).then((r) => ({ ...r, foods: undefined })),
    { kind: 'usda', foods: undefined, invalid: 1 });
  const invalid: unknown[] = [
    { ...kars, foodNutrients: without(1008) },
    { ...kars, servingSizeUnit: 'ONZ' },
    { ...kars, foodNutrients: [...without(1008), { nutrientId: 1008, unitName: 'kJ', value: 2092 }] },
  ];
  for (const record of invalid) {
    assert.deepEqual(await lookupBarcode(db, '077034085228', key, respond({ foods: [record] })), { kind: 'invalid-nutrition', count: 1 });
  }
  // The real Cheerios record lists each nutrient three times, including 359 and 117 kcal.
  assert.deepEqual(await lookupBarcode(db, '016000275287', key, respond(fixture('cheerios'))), { kind: 'invalid-nutrition', count: 1 });
  close();
});

test('missing key, rejected key, 429, server errors, offline, and timeout stay distinct', async (t) => {
  const { db, close } = await emptyDb();
  const code = '077034085228';
  assert.deepEqual(await lookupBarcode(db, code, noKey, unreachable), { kind: 'missing-key' });
  assert.deepEqual(await lookupBarcode(db, code, key, respond({ error: { code: 'API_KEY_INVALID' } }, 403)), { kind: 'rejected-key' });
  assert.deepEqual(await lookupBarcode(db, code, key, respond({ error: { code: 'OVER_RATE_LIMIT' } }, 429)), { kind: 'rate-limited' });
  assert.deepEqual(await lookupBarcode(db, code, key, respond({}, 500)), { kind: 'bad-response' });
  assert.deepEqual(await lookupBarcode(db, code, key, async () => new Response('<html>')), { kind: 'bad-response' });
  assert.deepEqual(await lookupBarcode(db, code, key, respond({ foods: 'none' })), { kind: 'bad-response' });
  assert.deepEqual(await lookupBarcode(db, code, key, async () => { throw new TypeError('Network request failed'); }), { kind: 'offline' });

  t.mock.timers.enable({ apis: ['setTimeout'] });
  const hung = lookupBarcode(db, code, key, (_, init) => new Promise((_, reject) =>
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  await new Promise(setImmediate);
  t.mock.timers.tick(USDA_TIMEOUT_MS);
  assert.deepEqual(await hung, { kind: 'timeout' });
  close();
});

test('a saved USDA food is found locally next time, and later edits leave its log alone', async () => {
  const { db, close } = await emptyDb();
  const [found] = usda(await lookupBarcode(db, '077034085228', key, respond({ foods: [kars] })));
  const id = await insertFood(db, found, found);
  const portion = logPortion({ ...found, id }, 28, 'g');
  assert.ok('portion' in portion);
  await insertEntry(db, { day: '2026-11-04', label: found.name, ...portion.nutrition }, portion.portion);

  const again = await lookupBarcode(db, '0077034085228', keyUnread, unreachable);
  assert.equal(again.kind, 'saved');
  const [saved] = (again as Extract<Lookup, { kind: 'saved' }>).foods;
  const { published: _, ...stored } = found;
  assert.deepEqual({ ...saved, source: { ...saved.source } }, { ...stored, id });
  await updateFood(db, id, { ...found, calories: 520 });
  const [entry] = await listEntries(db, '2026-11-04');
  assert.equal(entry.calories, 140);
  assert.deepEqual(saved.source, { id: 'fdc:2105222', name: USDA_SOURCE, retrievedOn: localDay() });
  close();
});
