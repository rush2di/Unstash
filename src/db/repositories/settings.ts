import type { SqlDatabase } from '../adapter';

/** Key-value preferences, stored as strings. Typed access lives in `src/features/settings`. */
export async function getAllSettings(db: SqlDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setSetting(db: SqlDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}
