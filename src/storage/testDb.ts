/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';

import type { Db } from './migrations.ts';

/** Real SQLite (Node's built-in) behind the same async surface the app gets from expo-sqlite. */
export function openTestDb(path: string) {
  // expo-sqlite leaves foreign keys off until the app turns them on.
  const sqlite = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  const db: Db = {
    execAsync: async (sql) => void sqlite.exec(sql),
    runAsync: async (sql, params) => ({
      lastInsertRowId: Number(sqlite.prepare(sql).run(...params).lastInsertRowid),
    }),
    getAllAsync: async <T>(sql: string, params: (string | number | null)[]) =>
      sqlite.prepare(sql).all(...params) as T[],
  };
  return { db, close: () => sqlite.close() };
}
