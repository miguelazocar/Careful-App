/// <reference types="jest" />
/// <reference types="node" />
/**
 * Test adapter: implements the app's `Db` contract on top of Node's built-in SQLite,
 * so repositories and migrations run against a real SQLite engine in Jest.
 */
import { setDb } from '../connection';
import { migrate } from '../migrations';
import type { Db, SqlParam } from '../types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

export function createNodeDb(): Db & { close(): void } {
  const db = new DatabaseSync(':memory:');
  let depth = 0;
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params: SqlParam[] = []) {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getAllAsync<T>(sql: string, params: SqlParam[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlParam[] = []) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      const name = `sp${depth++}`;
      db.exec(depth === 1 ? 'BEGIN' : `SAVEPOINT ${name}`);
      try {
        await task();
        db.exec(depth === 1 ? 'COMMIT' : `RELEASE ${name}`);
      } catch (e) {
        db.exec(depth === 1 ? 'ROLLBACK' : `ROLLBACK TO ${name}`);
        throw e;
      } finally {
        depth--;
      }
    },
    close() {
      db.close();
    },
  };
}

export async function setupTestDb(): Promise<Db & { close(): void }> {
  const db = createNodeDb();
  await migrate(db);
  setDb(db);
  return db;
}
