/**
 * SQLite schema.
 *
 * Column names are snake_case; the mapping to the camelCase domain types in
 * `src/types/domain.ts` lives in `src/db/mappers.ts`.
 */

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS collections (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_items (
  id                    TEXT PRIMARY KEY NOT NULL,
  instagram_url         TEXT NOT NULL,
  instagram_shortcode   TEXT,
  media_type            TEXT NOT NULL DEFAULT 'unknown',
  author_username       TEXT,
  caption               TEXT,
  thumbnail_url         TEXT,
  cached_thumbnail_path TEXT,
  collection_id         TEXT REFERENCES collections (id) ON DELETE SET NULL,
  saved_at              TEXT NOT NULL,
  reminder_at           TEXT,
  status                TEXT NOT NULL DEFAULT 'active',
  preview_status        TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS reminders (
  id              TEXT PRIMARY KEY NOT NULL,
  saved_item_id   TEXT NOT NULL REFERENCES saved_items (id) ON DELETE CASCADE,
  scheduled_at    TEXT NOT NULL,
  notification_id TEXT,
  completed_at    TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled'
);

CREATE INDEX IF NOT EXISTS idx_saved_items_instagram_url ON saved_items (instagram_url);
CREATE INDEX IF NOT EXISTS idx_saved_items_collection_id ON saved_items (collection_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_reminder_at   ON saved_items (reminder_at);
CREATE INDEX IF NOT EXISTS idx_saved_items_saved_at      ON saved_items (saved_at);
CREATE INDEX IF NOT EXISTS idx_reminders_saved_item_id   ON reminders (saved_item_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_at    ON reminders (scheduled_at);
`;

/**
 * v2: collection appearance, repeating reminders with notes, and user preferences.
 *
 * SQLite cannot add a column with IF NOT EXISTS, so this migration must run exactly once.
 * The runner guarantees that through `user_version`.
 */
export const SCHEMA_V2 = `
ALTER TABLE collections ADD COLUMN emoji TEXT;
ALTER TABLE collections ADD COLUMN color TEXT;

ALTER TABLE reminders ADD COLUMN repeat TEXT NOT NULL DEFAULT 'once';
ALTER TABLE reminders ADD COLUMN note TEXT;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;
