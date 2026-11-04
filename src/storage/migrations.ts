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
