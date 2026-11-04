// The subset of expo-sqlite's SQLiteDatabase this app uses, so tests can run real SQLite in Node.
export type Db = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: (string | number | null)[]): Promise<{ lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, params: (string | number | null)[]): Promise<T[]>;
};

// Migration N (1-based) is migrations[N - 1]. Append only; never edit a shipped migration.
export const migrations = [
  `CREATE TABLE diary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    label TEXT NOT NULL,
    calories REAL NOT NULL CHECK (calories >= 0),
    protein REAL CHECK (protein >= 0),
    carbs REAL CHECK (carbs >= 0),
    fat REAL CHECK (fat >= 0)
  );
  CREATE INDEX diary_entries_day ON diary_entries (day);`,
  // Nutrients are per 100 of basis. source_* and retrieved_on are for provider imports.
  `CREATE TABLE foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (name <> ''),
    basis TEXT NOT NULL CHECK (basis IN ('g', 'ml')),
    calories REAL NOT NULL CHECK (calories >= 0),
    protein REAL CHECK (protein >= 0),
    carbs REAL CHECK (carbs >= 0),
    fat REAL CHECK (fat >= 0),
    serving_name TEXT CHECK (serving_name <> ''),
    serving_amount REAL CHECK (serving_amount > 0),
    barcode TEXT CHECK (barcode GLOB '[0-9]*' AND barcode NOT GLOB '*[^0-9]*'),
    source_id TEXT,
    source_name TEXT,
    retrieved_on TEXT,
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    CHECK ((serving_name IS NULL) = (serving_amount IS NULL))
  );
  ALTER TABLE diary_entries ADD COLUMN food_id INTEGER REFERENCES foods (id);
  ALTER TABLE diary_entries ADD COLUMN amount REAL CHECK (amount > 0);
  ALTER TABLE diary_entries ADD COLUMN unit TEXT
    CHECK (unit IN ('g', 'ml') AND (amount IS NULL) = (unit IS NULL));`,
  // The one current target set. A nutrient without a target has no row.
  `CREATE TABLE targets (
    nutrient TEXT PRIMARY KEY CHECK (nutrient IN ('calories', 'protein', 'carbs', 'fat')),
    amount REAL NOT NULL CHECK (amount > 0)
  );`,
  // The brand a provider reported for an imported food, kept apart from its name.
  `ALTER TABLE foods ADD COLUMN brand TEXT CHECK (brand <> '');`,
  // Ingredients snapshot a saved food's nutrients per 100 g, so food edits never change a recipe.
  // servings and serving_name record how an amount was entered; grams is what counts.
  `CREATE TABLE recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (name <> ''),
    finished_grams REAL NOT NULL CHECK (finished_grams > 0)
  );
  CREATE TABLE recipe_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes (id),
    food_id INTEGER NOT NULL REFERENCES foods (id),
    name TEXT NOT NULL CHECK (name <> ''),
    grams REAL NOT NULL CHECK (grams > 0),
    servings REAL CHECK (servings > 0),
    serving_name TEXT CHECK (serving_name <> ''),
    calories REAL NOT NULL CHECK (calories >= 0),
    protein REAL CHECK (protein >= 0),
    carbs REAL CHECK (carbs >= 0),
    fat REAL CHECK (fat >= 0),
    CHECK ((servings IS NULL) = (serving_name IS NULL))
  );
  CREATE INDEX recipe_ingredients_recipe ON recipe_ingredients (recipe_id);`,
  // One weigh-in per local calendar day, in kilograms. preferences has at most one row; none = kg.
  `CREATE TABLE weights (
    day TEXT PRIMARY KEY CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    kg REAL NOT NULL CHECK (kg > 0)
  );
  CREATE TABLE preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    weight_unit TEXT NOT NULL CHECK (weight_unit IN ('kg', 'lb'))
  );`,
];

/**
 * Brings the schema up to the latest version, one transaction per migration.
 * @throws If the database was written by a newer app version, or a migration fails (rolled back).
 */
export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  const [{ user_version: current }] = await db.getAllAsync<{ user_version: number }>(
    'PRAGMA user_version',
    [],
  );
  if (current > migrations.length) {
    throw new Error(`Database version ${current} is newer than this app (${migrations.length})`);
  }
  for (let version = current + 1; version <= migrations.length; version++) {
    await db.execAsync('BEGIN');
    try {
      await db.execAsync(migrations[version - 1]);
      await db.execAsync(`PRAGMA user_version = ${version}`);
      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  }
}
