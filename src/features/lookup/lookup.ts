// Typed-barcode lookup: saved foods first, then USDA FoodData Central's Branded Foods search.
// API guide: https://fdc.nal.usda.gov/api-guide. Responses are checked here, not trusted as types.
import type { Db } from '../../storage/migrations';
import { localDay, type Unit } from '../diary/diary.ts';
import { findFoodsByBarcode, parseGtin, type Food, type FoodInput, type Gtin, type Provenance, type Source } from '../foods/foods.ts';

// A USDA record that passed validation, ready to inspect and save. Nutrition is per 100 of basis.
export type UsdaFood = FoodInput & Provenance & { source: Source; published: string | null };
// Every outcome of looking up a typed barcode. None of them blocks saved foods or manual creation.
export type Lookup =
  | { kind: 'invalid'; error: string }
  | { kind: 'saved'; foods: Food[] }
  | { kind: 'usda'; foods: UsdaFood[]; invalid: number }
  | { kind: 'invalid-nutrition'; count: number }
  | { kind: 'not-found' | 'missing-key' | 'rejected-key' | 'timeout' | 'rate-limited' | 'offline' | 'bad-response' };

export const USDA_SOURCE = 'USDA FoodData Central';
export const USDA_TIMEOUT_MS = 10_000;
const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
// FDC nutrient ids, the unit each must be reported in, and the most 100 g or 100 ml can hold.
const NUTRIENTS = {
  calories: { id: 1008, unit: 'KCAL', max: 900 },
  protein: { id: 1003, unit: 'G', max: 100 },
  fat: { id: 1004, unit: 'G', max: 100 },
  carbs: { id: 1005, unit: 'G', max: 100 },
} as const;
// Branded nutrients are per 100 of the unit the label's serving was given in.
const BASIS: Record<string, Unit> = { G: 'g', GRM: 'g', ML: 'ml', MLT: 'ml' };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

// USDA matches gtinUpc as an exact string, and its records use 12, 13, or 14 digits.
const forms = (gtin: Gtin) => [8, 12, 13, 14].filter((n) => /^0*$/.test(gtin.slice(0, 14 - n))).map((n) => gtin.slice(14 - n));

// One nutrient per 100 of basis: null when USDA has no value, undefined when its values are unusable.
function nutrient(list: unknown[], { id, unit, max }: (typeof NUTRIENTS)[keyof typeof NUTRIENTS]): number | null | undefined {
  const found = list.filter((n) => isObject(n) && n.nutrientId === id) as Record<string, unknown>[];
  if (found.length === 0) return null;
  const value = found[0].value;
  const usable = found.every((n) => String(n.unitName).toUpperCase() === unit && n.value === value);
  return usable && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
}

// A search result as a food to save, or null when its basis or nutrition cannot be trusted.
function usdaFood(raw: Record<string, unknown>, digits: string, retrievedOn: string): UsdaFood | null {
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

/** Validates a pasted api.data.gov key. It is stored only in SecureStore, never in SQLite. */
export function parseUsdaKey(input: string): { key: string } | { error: string } {
  const key = input.trim();
  if (key === '') return { error: 'Paste the key from your api.data.gov email' };
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return { error: "That isn't a key. Copy it again, without spaces" };
  return { key };
}

async function searchUsda(gtin: Gtin, digits: string, key: string, request: typeof fetch): Promise<Lookup> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), USDA_TIMEOUT_MS);
  let body: string;
  try {
    const query = new URLSearchParams({ query: forms(gtin).join(' '), dataType: 'Branded', pageSize: '50' });
    // The key goes in a header, so it never appears in a URL.
    const response = await request(`${SEARCH_URL}?${query}`, { headers: { 'X-Api-Key': key }, signal: controller.signal });
    if (response.status === 429) return { kind: 'rate-limited' };
    if (response.status === 401 || response.status === 403) return { kind: 'rejected-key' };
    if (!response.ok) return { kind: 'bad-response' };
    body = await response.text();
  } catch {
    return { kind: controller.signal.aborted ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
  try {
    return parseUsdaSearch(JSON.parse(body), gtin, digits, localDay());
  } catch {
    return { kind: 'bad-response' };
  }
}

/**
 * Checks saved foods first, with no key read or request. Only on a local miss does it read the key
 * and search USDA, and a missing key is an outcome, not an error.
 */
export async function lookupBarcode(db: Db, input: string, loadKey: () => Promise<string | null>, request = fetch): Promise<Lookup> {
  const code = parseGtin(input);
  if ('error' in code) return { kind: 'invalid', error: code.error };
  const foods = await findFoodsByBarcode(db, code.gtin);
  if (foods.length > 0) return { kind: 'saved', foods };
  const key = await loadKey();
  if (!key) return { kind: 'missing-key' };
  return searchUsda(code.gtin, code.digits, key, request);
}
