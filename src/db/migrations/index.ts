import { SCHEMA_V1, SCHEMA_V2 } from '../schema';

export type Migration = {
  version: number;
  name: string;
  sql: string;
};

/**
 * Ordered migration list. Append new entries; never edit a released one.
 * The applied version is tracked in SQLite's `user_version` pragma.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    sql: SCHEMA_V1,
  },
  {
    version: 2,
    name: 'collection-appearance-reminder-repeat-settings',
    sql: SCHEMA_V2,
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce(
  (highest, migration) => Math.max(highest, migration.version),
  0
);
