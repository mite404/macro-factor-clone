// Storybook's stand-in for expo-sqlite: the same wa-sqlite engine expo-sqlite runs on web, but
// on the main thread with a fresh in-memory database per provider. It never touches nutrition.db.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SQLite from 'wa-sqlite';
import factory from 'wa-sqlite/dist/wa-sqlite.mjs';
import { MemoryVFS } from 'wa-sqlite/src/examples/MemoryVFS.js';
import wasmUrl from 'wa-sqlite/wa-sqlite.wasm?url';

import type { Db } from '../src/storage/migrations';

type Params = (string | number | null)[];

const api = (async () => {
  const module = await factory({ locateFile: () => wasmUrl });
  const sqlite3 = SQLite.Factory(module);
  sqlite3.vfs_register(await MemoryVFS.create('story-memory', module), true);
  return sqlite3;
})();

async function openMemoryDb(): Promise<Db & { close(): Promise<void> }> {
  const sqlite3 = await api;
  const db = await sqlite3.open_v2(':memory:');
  const all = async <T,>(sql: string, params: Params) => {
    const rows: T[] = [];
    for await (const stmt of sqlite3.statements(db, sql)) {
      if (params.length > 0) sqlite3.bind_collection(stmt, params);
      const columns = sqlite3.column_names(stmt);
      while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        const row = sqlite3.row(stmt);
        rows.push(Object.fromEntries(columns.map((c, i) => [c, row[i]])) as T);
      }
    }
    return rows;
  };
  return {
    execAsync: async (sql) => void (await sqlite3.exec(db, sql)),
    runAsync: async (sql, params) => {
      await all(sql, params);
      return { lastInsertRowId: Number(sqlite3.last_insert_rowid(db)) };
    },
    getAllAsync: all,
    close: async () => void (await sqlite3.close(db)),
  };
}

const Context = createContext<Db | null>(null);

/** Same props the app passes to expo-sqlite's provider; `databaseName` is ignored. */
export function SQLiteProvider(props: { databaseName: string; onInit?: (db: Db) => Promise<void>; children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const opening = openMemoryDb();
    opening
      .then(async (opened) => {
        await props.onInit?.(opened);
        setDb(opened);
      })
      .catch(setError);
    return () => void opening.then((opened) => opened.close());
  }, []);
  if (error) throw error;
  return db && <Context.Provider value={db}>{props.children}</Context.Provider>;
}

/** The provider's database, typed as the app's `Db` surface. */
export function useSQLiteContext(): Db {
  const db = useContext(Context);
  if (!db) throw new Error('useSQLiteContext must be inside SQLiteProvider');
  return db;
}
