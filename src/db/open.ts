import * as SQLite from 'expo-sqlite';

import { getDb, setDb } from './connection';
import { migrate } from './migrations';
import type { Db, SqlParam } from './types';

export const DB_NAME = 'careful.db';

let opening: Promise<Db> | null = null;

function adapt(sqlite: SQLite.SQLiteDatabase): Db {
  return {
    execAsync: (sql) => sqlite.execAsync(sql),
    runAsync: (sql, params: SqlParam[] = []) => sqlite.runAsync(sql, params),
    getAllAsync: <T,>(sql: string, params: SqlParam[] = []) => sqlite.getAllAsync<T>(sql, params),
    getFirstAsync: <T,>(sql: string, params: SqlParam[] = []) => sqlite.getFirstAsync<T>(sql, params),
    withTransactionAsync: (task) => sqlite.withTransactionAsync(task),
  };
}

/** Opens (once) and migrates the local database. Safe to call from UI and background tasks. */
export function initDatabase(): Promise<Db> {
  if (!opening) {
    opening = (async () => {
      const sqlite = await SQLite.openDatabaseAsync(DB_NAME);
      await sqlite.execAsync('PRAGMA journal_mode = WAL;');
      const db = adapt(sqlite);
      await migrate(db);
      setDb(db);
      return db;
    })().catch((e) => {
      opening = null;
      throw e;
    });
  }
  return opening;
}

export function isDatabaseReady(): boolean {
  try {
    getDb();
    return true;
  } catch {
    return false;
  }
}
