import type { SqlDatabase } from './adapter';
import { LATEST_VERSION, MIGRATIONS } from './migrations';

type UserVersionRow = { user_version: number };

/**
 * Applies every migration newer than the database's current `user_version`.
 *
 * Safe to call on every launch: it is a no-op once the database is current.
 */
export async function migrate(db: SqlDatabase): Promise<number> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion >= LATEST_VERSION) {
    return currentVersion;
  }

  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  for (const migration of pending) {
    await db.execAsync(migration.sql);
    // `user_version` cannot be set with a bound parameter.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }

  return LATEST_VERSION;
}
