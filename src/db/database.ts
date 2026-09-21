import * as SQLite from 'expo-sqlite';

import type { SqlDatabase, SqlRunResult, SqlValue } from './adapter';
import { migrate } from './migrate';

export const DATABASE_NAME = 'remindme.db';

/** Wraps `expo-sqlite` in the narrow `SqlDatabase` port the repositories depend on. */
export function wrapExpoDatabase(db: SQLite.SQLiteDatabase): SqlDatabase {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: async (sql, params = []): Promise<SqlRunResult> => {
      const result = await db.runAsync(sql, params as SQLite.SQLiteBindValue[]);
      return { lastInsertRowId: result.lastInsertRowId, changes: result.changes };
    },
    getAllAsync: <T,>(sql: string, params: SqlValue[] = []) =>
      db.getAllAsync<T>(sql, params as SQLite.SQLiteBindValue[]),
    getFirstAsync: <T,>(sql: string, params: SqlValue[] = []) =>
      db.getFirstAsync<T>(sql, params as SQLite.SQLiteBindValue[]),
    withTransactionAsync: (body) => db.withExclusiveTransactionAsync(() => body()),
  };
}

let cached: SqlDatabase | null = null;

/**
 * Opens the app database and applies pending migrations.
 * The result is cached, so later calls are cheap.
 */
export async function openDatabase(): Promise<SqlDatabase> {
  if (cached) {
    return cached;
  }

  const native = await SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = wrapExpoDatabase(native);
  await migrate(db);
  cached = db;
  return db;
}

/** Test and reset hook. Drops the cached handle so the next `openDatabase` reopens. */
export function resetDatabaseCache(): void {
  cached = null;
}
