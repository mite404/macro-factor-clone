/// <reference path="../node_modules/expo-sqlite/web/wa-sqlite/types/index.d.ts" />
/// <reference types="vite/client" />

declare module 'wa-sqlite/src/examples/MemoryVFS.js' {
  export class MemoryVFS {
    static create(name: string, module: unknown): Promise<SQLiteVFS>;
  }
}
