/**
 * Narrow database port.
 *
 * Repositories depend on this interface rather than on `expo-sqlite` directly, so the same
 * SQL can run on device and under Node in tests. See `docs/ARCHITECTURE.md` §3.
 */

export type SqlValue = string | number | null;

export type SqlRunResult = {
  lastInsertRowId: number;
  changes: number;
};

export interface SqlDatabase {
  /** Runs one or more statements. Used for schema work, not for parameterised queries. */
  execAsync(sql: string): Promise<void>;

  /** Runs a single write statement. */
  runAsync(sql: string, params?: SqlValue[]): Promise<SqlRunResult>;

  /** Reads every matching row. */
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>;

  /** Reads the first matching row, or `null` when there is none. */
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>;

  /** Runs `body` inside a transaction, rolling back if it throws. */
  withTransactionAsync(body: () => Promise<void>): Promise<void>;
}
