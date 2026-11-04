import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { migrate } from '../../storage/migrations.ts';
import { openTestDb } from '../../storage/testDb.ts';
import { insertEntry, listEntries, localDay } from '../diary/diary.ts';
import { archiveFood, expandUpcE, insertFood, logPortion, parseGtin, updateFood } from '../foods/foods.ts';
import { exportBackup, parseBackup, restoreBackup } from '../backup/backup.ts';
import { lookupBarcode, lookupOff, OFF_SOURCE, TIMEOUT_MS, USDA_SOURCE, USER_AGENT, type Lookup, type OffResult } from './lookup.ts';

// Unmodified FoodData Central search responses, recorded 2026-11-04 for these barcodes.
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./usda-search-${name}.json`, import.meta.url), 'utf8'));
const kars = fixture('kars').foods[0]; // gtinUpc "077034085228", 500 kcal per 100 g
const cheerios = fixture('cheerios').foods[0]; // gtinUpc "00016000275287", conflicting duplicate nutrients
// Unmodified Open Food Facts product replies, recorded 2026-11-04 with the app's fields and User-Agent.
const offFixture = (name: string) => JSON.parse(readFileSync(new URL(`./off-product-${name}.json`, import.meta.url), 'utf8'));
const nutella = offFixture('nutella'); // v3.5; its macros share source_index 0, fiber comes from record 2

const key = async () => 'fixture-key';
const noKey = async () => null;
const respond = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
const noUsda = { totalHits: 0, foods: [] };
// Replies by provider host, and every URL and header set requested.
function providers(usdaBody: unknown, offBody: unknown, offStatus = 200) {
  const calls: { url: string; headers: unknown }[] = [];
  const request = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), headers: init?.headers });
    const off = String(input).startsWith('https://world.openfoodfacts.org/');
    return new Response(JSON.stringify(off ? offBody : usdaBody), { status: off ? offStatus : 200 });
  };
  return { calls, request };
}
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

test('expands a scanned UPC-E to the UPC-A its check digit belongs to', () => {
  // Each last-digit rule (0-2, 3, 4, 5-9), the 2/3 boundary, and number system 1. 04963406 is the Coca-Cola can example.
  for (const [upcE, upcA] of [['04963406', '049000006346'], ['01234514', '012100003454'], ['01234523', '012200003453'], ['01234531', '012300000451'],
    ['01234543', '012340000053'], ['01234565', '012345000065'], ['11234562', '112345000062']]) {
    assert.equal(expandUpcE(upcE), upcA);
    assert.ok('gtin' in parseGtin(expandUpcE(upcE)), upcE);
  }
  assert.equal(expandUpcE('24963406'), '24963406', 'only number systems 0 and 1 are UPC-E');
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
  const off = providers(null, offFixture('not-found'), 404);
  assert.deepEqual(await lookupBarcode(db, '036000291452', noKey, off.request), { kind: 'missing-key', off: { kind: 'not-found' } }, 'archived foods are hidden');
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

  const miss = respond({ result: { id: 'product_not_found' } }, 404);
  const neither = (usdaBody: unknown) => async (input: string | URL | Request) =>
    (String(input).includes('openfoodfacts') ? miss() : respond(usdaBody)());
  assert.deepEqual(await lookupBarcode(db, '077034085228', key, neither({ foods: [cheerios, top] })), { kind: 'not-found', off: { kind: 'not-found' } });
  assert.deepEqual(await lookupBarcode(db, '077034085228', key, neither(noUsda)), { kind: 'not-found', off: { kind: 'not-found' } });
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
  t.mock.timers.tick(TIMEOUT_MS);
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

function off(result: Lookup | OffResult) {
  const found = 'off' in result ? result.off : result;
  assert.equal(found?.kind, 'off', JSON.stringify(result));
  return (found as Extract<OffResult, { kind: 'off' }>).food;
}

// Nutella's aggregated set with each named nutrient changed; null removes it.
function nutellaWith(nutrients: Record<string, object | null>, set: object = {}) {
  const aggregated = nutella.product.nutrition.aggregated_set;
  const changed = { ...aggregated.nutrients, ...nutrients };
  for (const [id, n] of Object.entries(nutrients)) if (n === null) delete changed[id];
  return { ...nutella, product: { ...nutella.product, nutrition: { aggregated_set: { ...aggregated, nutrients: changed, ...set } } } };
}

test('an exact USDA miss falls back to Open Food Facts, which identifies the app and gets no key', async () => {
  const { db, close } = await emptyDb();
  const { calls, request } = providers(noUsda, nutella);
  const result = await lookupBarcode(db, '3017620422003', key, request);

  assert.equal(result.kind, 'not-found');
  assert.deepEqual({ ...off(result) }, {
    name: 'Nutella', basis: 'g', calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9, barcode: '3017620422003',
    serving: null, brand: 'Nutella, Ferrero', source: { id: 'off:3017620422003', name: OFF_SOURCE, retrievedOn: localDay() },
    published: null,
  });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.startsWith('https://api.nal.usda.gov/'));
  const url = new URL(calls[1].url);
  assert.equal(`${url.origin}${url.pathname}`, 'https://world.openfoodfacts.org/api/v3.5/product/3017620422003');
  assert.equal(url.searchParams.get('fields'), 'code,product_name,brands,serving_quantity,serving_quantity_unit,nutrition.aggregated_set,schema_version');
  assert.deepEqual(calls[1].headers, { 'User-Agent': USER_AGENT });
  assert.match(USER_AGENT, /^[\w-]+\/[\d.]+ \(.+\)$/, 'AppName/Version (contact), as OFF asks');

  const both = providers(noUsda, offFixture('not-found'), 404);
  assert.deepEqual(await lookupBarcode(db, '2908173645289', key, both.request), { kind: 'not-found', off: { kind: 'not-found' } });
  close();
});

test('with no USDA key, Open Food Facts is asked directly', async () => {
  const { db, close } = await emptyDb();
  const { calls, request } = providers(null, offFixture('kars'));
  const food = off(await lookupBarcode(db, '077034085228', noKey, request));
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith('https://world.openfoodfacts.org/'));
  // OFF sends this serving_quantity as the string "28" and has no brand for it.
  assert.deepEqual([food.serving, food.brand, food.carbs, food.source.id], [{ name: 'serving', amount: 28 }, null, 42.86, 'off:0077034085228']);
  close();
});

test('a USDA failure is not a miss: Open Food Facts is asked only on request', async () => {
  const { db, close } = await emptyDb();
  const code = '3017620422003';
  const usdaOnly = (status: number) => async (input: string | URL | Request) => {
    assert.ok(String(input).startsWith('https://api.nal.usda.gov/'), 'no automatic Open Food Facts request');
    return new Response('{}', { status });
  };
  assert.deepEqual(await lookupBarcode(db, code, key, usdaOnly(429)), { kind: 'rate-limited' });
  assert.deepEqual(await lookupBarcode(db, code, key, usdaOnly(403)), { kind: 'rejected-key' });
  assert.deepEqual(await lookupBarcode(db, code, key, usdaOnly(500)), { kind: 'bad-response' });
  assert.deepEqual(await lookupBarcode(db, code, key, async () => { throw new TypeError('Network request failed'); }), { kind: 'offline' });
  assert.deepEqual(await lookupBarcode(db, '016000275287', key, respond(fixture('cheerios'))), { kind: 'invalid-nutrition', count: 1 });

  assert.equal(off(await lookupOff(code, providers(null, nutella).request)).name, 'Nutella');
  close();
});

test('Open Food Facts nutrition from other records, estimates, or the old schema is never used', async () => {
  const code = '3017620422003';
  const ask = (body: unknown, status = 200) => lookupOff(code, respond(body, status));
  const nutellaSet = nutella.product.nutrition.aggregated_set.nutrients;

  const missing = off(await ask(nutellaWith({ proteins: null, fat: null })));
  assert.deepEqual([missing.calories, missing.protein, missing.fat, missing.carbs], [539, null, null, 57.5], 'missing macros are unknown, not 0');
  // The fixture's own packaging record (index 2) lists 30 g protein; it must not fill in a gap.
  const merged = off(await ask(nutellaWith({ proteins: { ...nutellaSet.proteins, source: 'packaging', source_index: 2, value: 30 } })));
  assert.equal(merged.protein, null);
  assert.equal(off(await ask(nutellaWith({ fat: { ...nutellaSet.fat, value: 0 } }))).fat, 0, 'a known 0 stays 0');

  // A real product saved with a name and no nutrition at all.
  assert.deepEqual(await lookupOff('4006381333931', respond(offFixture('no-nutrition'))), { kind: 'invalid-nutrition' });
  const unusable: unknown[] = [
    nutellaWith({ 'energy-kcal': null }),
    nutellaWith({ 'energy-kcal': { ...nutellaSet['energy-kcal'], source: 'estimate', source_index: 3 } }),
    nutellaWith({}, { preparation: 'prepared' }),
    nutellaWith({}, { per: 'serving' }),
    nutellaWith({ fat: { ...nutellaSet.fat, unit: 'mg' } }),
    nutellaWith({ proteins: { ...nutellaSet.proteins, value: -1 } }),
  ];
  for (const body of unusable) assert.deepEqual(await ask(body), { kind: 'invalid-nutrition' });

  // The same product from unversioned v3, which still sends `nutriments` (schema 999).
  const old = offFixture('nutella-old-schema');
  assert.equal(old.product.nutriments['energy-kcal_100g'], 539);
  assert.deepEqual(await ask(old), { kind: 'bad-response' });
  assert.deepEqual(await ask({ ...nutella, product: { ...nutella.product, code: '3017620422010' } }), { kind: 'not-found' }, 'another code is another product');

});

test('Open Food Facts limits, outages, and malformed replies stay distinct from not found', async (t) => {
  const code = '3017620422003';
  assert.deepEqual(await lookupOff(code, respond({}, 429)), { kind: 'rate-limited' });
  assert.deepEqual(await lookupOff(code, respond({}, 503)), { kind: 'rate-limited' });
  assert.deepEqual(await lookupOff(code, respond({}, 500)), { kind: 'bad-response' });
  assert.deepEqual(await lookupOff(code, async () => new Response('<html>Not Found</html>', { status: 404 })), { kind: 'bad-response' });
  assert.deepEqual(await lookupOff(code, async () => new Response('<html>')), { kind: 'bad-response' });
  assert.deepEqual(await lookupOff(code, async () => { throw new TypeError('Network request failed'); }), { kind: 'offline' });

  t.mock.timers.enable({ apis: ['setTimeout'] });
  const hung = lookupOff(code, (_, init) => new Promise((_, reject) =>
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  await new Promise(setImmediate);
  t.mock.timers.tick(TIMEOUT_MS);
  assert.deepEqual(await hung, { kind: 'timeout' });
});

test('a saved Open Food Facts food works offline and keeps its source through backup and restore', async () => {
  const { db, close } = await emptyDb();
  const found = off(await lookupBarcode(db, '3017620422003', noKey, providers(null, nutella).request));
  const id = await insertFood(db, found, found);
  const { published: _, ...stored } = found;

  const again = await lookupBarcode(db, '03017620422003', keyUnread, unreachable);
  assert.equal(again.kind, 'saved');
  assert.deepEqual((again as Extract<Lookup, { kind: 'saved' }>).foods.map((f) => ({ ...f, source: { ...f.source } })), [{ ...stored, id }]);

  const backup = parseBackup(JSON.stringify(await exportBackup(db)));
  assert.ok('backup' in backup);
  const restored = await emptyDb();
  await restoreBackup(restored.db, backup.backup);
  const after = await lookupBarcode(restored.db, '3017620422003', keyUnread, unreachable);
  assert.deepEqual((after as Extract<Lookup, { kind: 'saved' }>).foods.map((f) => ({ ...f, source: { ...f.source } })), [{ ...stored, id }]);
  restored.close();
  close();
});
