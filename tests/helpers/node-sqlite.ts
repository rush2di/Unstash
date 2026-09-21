import { DatabaseSync } from 'node:sqlite';

import type { SqlDatabase, SqlValue } from '@/db/adapter';
import { migrate } from '@/db/migrate';

/**
 * Runs the app's real SQL against Node's built-in SQLite.
 *
 * `expo-sqlite` needs a device, so repository tests use this adapter instead. The schema,
 * migrations and queries under test are the same ones the app ships.
 */
export function createNodeDatabase(): SqlDatabase & { close: () => void } {
  const db = new DatabaseSync(':memory:');

  const toBind = (params: SqlValue[]) => params as (string | number | null)[];

  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params = []) {
      const result = db.prepare(sql).run(...toBind(params));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getAllAsync<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...toBind(params)) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[] = []) {
      const row = db.prepare(sql).get(...toBind(params));
      return (row ?? null) as T | null;
    },
    async withTransactionAsync(body) {
      db.exec('BEGIN');
      try {
        await body();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}

/** A migrated, empty database for one test. */
export async function createTestDatabase() {
  const db = createNodeDatabase();
  await migrate(db);
  return db;
}
