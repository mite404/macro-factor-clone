// Typed-barcode lookup: saved foods first, then USDA FoodData Central's Branded Foods search, then
// Open Food Facts. USDA: https://fdc.nal.usda.gov/api-guide. Open Food Facts:
// https://openfoodfacts.github.io/documentation/docs/Product-Opener/api. Responses are checked
// here, not trusted as types.
import type { Db } from '../../storage/migrations';
import { localDay, type Unit } from '../diary/diary.ts';
import { findFoodsByBarcode, parseGtin, type Food, type FoodInput, type Gtin, type Provenance, type Source } from '../foods/foods.ts';

// A provider record that passed validation, ready to inspect and save. Nutrition is per 100 of basis.
export type ProviderFood = FoodInput & Provenance & { source: Source; published: string | null };
type Failure = 'timeout' | 'rate-limited' | 'offline' | 'bad-response';
// Open Food Facts, asked automatically when USDA has no exact match or no key, and on request
// after any other USDA outcome. It returns at most one product per barcode.
export type OffResult = { kind: 'off'; food: ProviderFood } | { kind: 'not-found' | 'invalid-nutrition' | Failure };
type UsdaMiss = { kind: 'invalid-nutrition'; count: number } | { kind: 'not-found' | 'missing-key' | 'rejected-key' | Failure };
// A USDA outcome without a usable match, and Open Food Facts' answer once it has been asked.
export type Miss = UsdaMiss & { off?: OffResult };
// Every outcome of looking up a typed barcode. None of them blocks saved foods or manual creation.
export type Lookup =
  | { kind: 'invalid'; error: string }
  | { kind: 'saved'; foods: Food[] }
  | { kind: 'usda'; foods: ProviderFood[]; invalid: number }
  | Miss;

export const USDA_SOURCE = 'USDA FoodData Central';
export const OFF_SOURCE = 'Open Food Facts';
/** Open Food Facts' database license, linked wherever its data is shown. */
export const ODBL_URL = 'https://opendatacommons.org/licenses/odbl/1.0/';
/** Each provider request gives up after this long. */
export const TIMEOUT_MS = 10_000;
// Open Food Facts asks every app to identify itself as AppName/Version (contact).
export const USER_AGENT = 'macro-factor-clone/1.0 (https://github.com/mite404/macro-factor-clone)';
const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
// v3.5 is the first version with the `nutrition` structure; unversioned v3 still sends `nutriments`.
const OFF_URL = 'https://world.openfoodfacts.org/api/v3.5/product/';
const OFF_FIELDS = 'code,product_name,brands,serving_quantity,serving_quantity_unit,nutrition.aggregated_set,schema_version';
const OFF_SCHEMA = 1003;
// Per nutrient: FDC id, Open Food Facts id, the unit each must be reported in, and the most
// 100 g or 100 ml can hold.
const NUTRIENTS = {
  calories: { id: 1008, off: 'energy-kcal', unit: 'KCAL', max: 900 },
  protein: { id: 1003, off: 'proteins', unit: 'G', max: 100 },
  fat: { id: 1004, off: 'fat', unit: 'G', max: 100 },
  carbs: { id: 1005, off: 'carbohydrates', unit: 'G', max: 100 },
} as const;
type NutrientSpec = (typeof NUTRIENTS)[keyof typeof NUTRIENTS];
// Branded nutrients are per 100 of the unit the label's serving was given in.
const BASIS: Record<string, Unit> = { G: 'g', GRM: 'g', ML: 'ml', MLT: 'ml' };
const OFF_BASIS: Record<string, Unit> = { '100g': 'g', '100ml': 'ml' };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const usable = (value: unknown, unit: unknown, spec: NutrientSpec) => String(unit).toUpperCase() === spec.unit &&
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= spec.max;

// USDA matches gtinUpc as an exact string, and its records use 12, 13, or 14 digits.
const forms = (gtin: Gtin) => [8, 12, 13, 14].filter((n) => /^0*$/.test(gtin.slice(0, 14 - n))).map((n) => gtin.slice(14 - n));

// One nutrient per 100 of basis: null when USDA has no value, undefined when its values are unusable.
function nutrient(list: unknown[], spec: NutrientSpec): number | null | undefined {
  const found = list.filter((n) => isObject(n) && n.nutrientId === spec.id) as Record<string, unknown>[];
  if (found.length === 0) return null;
  const value = found[0].value;
  return found.every((n) => n.value === value && usable(n.value, n.unitName, spec)) ? (value as number) : undefined;
}

// A search result as a food to save, or null when its basis or nutrition cannot be trusted.
function usdaFood(raw: Record<string, unknown>, digits: string, retrievedOn: string): ProviderFood | null {
  const name = text(raw.description);
  const basis = BASIS[String(raw.servingSizeUnit).toUpperCase()];
  const list = Array.isArray(raw.foodNutrients) ? raw.foodNutrients : [];
  const [calories, protein, fat, carbs] = Object.values(NUTRIENTS).map((n) => nutrient(list, n));
  if (!Number.isSafeInteger(raw.fdcId) || !name || !basis || calories == null || [protein, fat, carbs].includes(undefined)) {
    return null;
  }
  const size = raw.servingSize;
  return {
    name, basis, calories, protein: protein!, carbs: carbs!, fat: fat!, barcode: digits,
    serving: typeof size === 'number' && Number.isFinite(size) && size > 0
      ? { name: text(raw.householdServingFullText) ?? 'serving', amount: size } : null,
    brand: text(raw.brandName) ?? text(raw.brandOwner),
    source: { id: `fdc:${raw.fdcId}`, name: USDA_SOURCE, retrievedOn },
    published: text(raw.publishedDate),
  };
}

/**
 * Keeps only records whose own gtinUpc is the same GTIN, whatever their search rank. Records with a
 * malformed gtinUpc never match, so a dropped leading zero cannot pass for another product.
 */
export function parseUsdaSearch(json: unknown, gtin: Gtin, digits: string, retrievedOn: string): Lookup {
  if (!isObject(json) || !Array.isArray(json.foods)) return { kind: 'bad-response' };
  const exact = json.foods.filter((f): f is Record<string, unknown> => {
    if (!isObject(f) || typeof f.gtinUpc !== 'string') return false;
    const code = parseGtin(f.gtinUpc);
    return 'gtin' in code && code.gtin === gtin;
  });
  if (exact.length === 0) return { kind: 'not-found' };
  const foods = exact.map((f) => usdaFood(f, digits, retrievedOn)).filter((f) => f !== null);
  if (foods.length === 0) return { kind: 'invalid-nutrition', count: exact.length };
  return { kind: 'usda', foods, invalid: exact.length - foods.length };
}

/**
 * Reads an Open Food Facts v3.5 product reply. Uses the aggregated set, which is per 100 g or
 * 100 ml in g and kcal, but only values from the same label record as its calories: OFF fills
 * other nutrients from other records and estimates, and those stay unknown rather than merged.
 * A reply in the older `nutriments` schema is a bad response, never parsed.
 */
export function parseOffProduct(json: unknown, gtin: Gtin, digits: string, retrievedOn: string): OffResult {
  if (!isObject(json)) return { kind: 'bad-response' };
  if (isObject(json.result) && json.result.id === 'product_not_found') return { kind: 'not-found' };
  const product = json.product;
  if (!isObject(product) || typeof product.code !== 'string' || typeof product.schema_version !== 'number' ||
    product.schema_version < OFF_SCHEMA) return { kind: 'bad-response' };
  // OFF normalizes leading zeros, so its code must still be the typed product.
  const code = parseGtin(product.code);
  if (!('gtin' in code) || code.gtin !== gtin) return { kind: 'not-found' };
  const set = isObject(product.nutrition) ? product.nutrition.aggregated_set : null;
  const basis = isObject(set) && set.preparation === 'as_sold' ? OFF_BASIS[String(set.per)] : undefined;
  const found = isObject(set) && isObject(set.nutrients) ? set.nutrients : {};
  const energy = found[NUTRIENTS.calories.off];
  const name = text(product.product_name);
  if (!basis || !name || !isObject(energy) || !Number.isInteger(energy.source_index) || energy.source === 'estimate') {
    return { kind: 'invalid-nutrition' };
  }
  const [calories, protein, fat, carbs] = Object.values(NUTRIENTS).map((spec) => {
    const n = found[spec.off];
    if (!isObject(n) || n.source_index !== energy.source_index) return null;
    return usable(n.value, n.unit, spec) ? (n.value as number) : undefined;
  });
  if (calories == null || [protein, fat, carbs].includes(undefined)) return { kind: 'invalid-nutrition' };
  const size = Number(product.serving_quantity); // OFF sends this as a number or a numeric string
  return {
    kind: 'off',
    food: {
      name, basis, calories, protein: protein!, carbs: carbs!, fat: fat!, barcode: digits,
      serving: size > 0 && Number.isFinite(size) && String(product.serving_quantity_unit).toLowerCase() === basis
        ? { name: 'serving', amount: size } : null,
      brand: text(product.brands),
      source: { id: `off:${product.code}`, name: OFF_SOURCE, retrievedOn },
      published: null,
    },
  };
}

/** Validates a pasted api.data.gov key. It is stored only in SecureStore, never in SQLite. */
export function parseUsdaKey(input: string): { key: string } | { error: string } {
  const key = input.trim();
  if (key === '') return { error: 'Paste the key from your api.data.gov email' };
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return { error: "That isn't a key. Copy it again, without spaces" };
  return { key };
}

// One GET with a timeout. No retries: every request is a tap.
type Reply = { status: number; ok: boolean; body: string } | { kind: 'timeout' | 'offline' };
async function get(url: string, headers: Record<string, string>, request: typeof fetch): Promise<Reply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await request(url, { headers, signal: controller.signal });
    return { status: response.status, ok: response.ok, body: await response.text() };
  } catch {
    return { kind: controller.signal.aborted ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

function parsed<T>(body: string, parse: (json: unknown) => T): T | { kind: 'bad-response' } {
  try {
    return parse(JSON.parse(body));
  } catch {
    return { kind: 'bad-response' };
  }
}

async function searchUsda(gtin: Gtin, digits: string, key: string, request: typeof fetch): Promise<Lookup> {
  const query = new URLSearchParams({ query: forms(gtin).join(' '), dataType: 'Branded', pageSize: '50' });
  // The key goes in a header, so it never appears in a URL.
  const reply = await get(`${SEARCH_URL}?${query}`, { 'X-Api-Key': key }, request);
  if ('kind' in reply) return reply;
  if (reply.status === 429) return { kind: 'rate-limited' };
  if (reply.status === 401 || reply.status === 403) return { kind: 'rejected-key' };
  if (!reply.ok) return { kind: 'bad-response' };
  return parsed(reply.body, (json) => parseUsdaSearch(json, gtin, digits, localDay()));
}

async function searchOff(gtin: Gtin, digits: string, request: typeof fetch): Promise<OffResult> {
  // ponytail: one request per tap stays well under OFF's 15 product reads a minute per user; add a
  // client-side limiter if anything ever looks codes up without a tap.
  const reply = await get(`${OFF_URL}${digits}?fields=${OFF_FIELDS}`, { 'User-Agent': USER_AGENT }, request);
  if ('kind' in reply) return reply;
  // 503 is OFF's global rate limit as well as maintenance.
  if (reply.status === 429 || reply.status === 503) return { kind: 'rate-limited' };
  if (!reply.ok && reply.status !== 404) return { kind: 'bad-response' };
  const result = parsed(reply.body, (json) => parseOffProduct(json, gtin, digits, localDay()));
  return reply.status === 404 && result.kind !== 'not-found' ? { kind: 'bad-response' } : result;
}

/**
 * Checks saved foods first, with no key read or request. Only on a local miss does it read the key
 * and search USDA. When USDA has no exact match, or there is no key, it asks Open Food Facts. Any
 * other USDA outcome is returned as is, so a failure never reads as not found.
 */
export async function lookupBarcode(db: Db, input: string, loadKey: () => Promise<string | null>, request = fetch): Promise<Lookup> {
  const code = parseGtin(input);
  if ('error' in code) return { kind: 'invalid', error: code.error };
  const foods = await findFoodsByBarcode(db, code.gtin);
  if (foods.length > 0) return { kind: 'saved', foods };
  const key = await loadKey();
  const usda: Lookup = key ? await searchUsda(code.gtin, code.digits, key, request) : { kind: 'missing-key' };
  if (usda.kind !== 'not-found' && usda.kind !== 'missing-key') return usda;
  return { ...usda, off: await searchOff(code.gtin, code.digits, request) };
}

/**
 * Asks Open Food Facts alone, when the owner chooses to after a USDA failure.
 * @throws If `input` is not a valid barcode; only a looked-up code can reach this.
 */
export async function lookupOff(input: string, request = fetch): Promise<OffResult> {
  const code = parseGtin(input);
  if ('error' in code) throw new Error(code.error);
  return searchOff(code.gtin, code.digits, request);
}
