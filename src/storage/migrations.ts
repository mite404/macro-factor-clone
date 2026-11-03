// The subset of expo-sqlite's SQLiteDatabase this app uses, so tests can run real SQLite in Node.
export type Db = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: (string | number | null)[]): Promise<T[]>;
};

// Migration N (1-based) is migrations[N - 1]. Append only; never edit a shipped migration.
const migrations = [
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
];

/**
 * Brings the schema up to the latest version, one transaction per migration.
 * @throws If the database was written by a newer app version, or a migration fails (rolled back).
 */
export async function migrate(db: Db): Promise<void> {
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
