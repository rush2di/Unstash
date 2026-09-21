import type { SqlDatabase, SqlValue } from '../adapter';
import { type SavedItemRow, toSavedItem } from '../mappers';

import type { MediaType, PreviewStatus, SavedItem, SavedItemStatus } from '@/types/domain';
import { createId } from '@/utils/id';

export type CreateSavedItemInput = {
  instagramUrl: string;
  instagramShortcode?: string;
  mediaType?: MediaType;
  collectionId?: string;
  authorUsername?: string;
  caption?: string;
  thumbnailUrl?: string;
  /** Overrides for tests and for restoring from a backup. */
  id?: string;
  savedAt?: string;
  previewStatus?: PreviewStatus;
};

/** Fields the preview resolver is allowed to fill in later. */
export type PreviewPatch = {
  mediaType?: MediaType;
  authorUsername?: string;
  caption?: string;
  thumbnailUrl?: string;
  cachedThumbnailPath?: string;
  previewStatus: PreviewStatus;
};

export type SavedItemFilter = 'all' | 'upcoming' | 'overdue' | 'completed' | 'no-reminder';

const SELECT_ITEM = 'SELECT * FROM saved_items';

function nullable(value: string | undefined): SqlValue {
  return value ?? null;
}

export async function createSavedItem(
  db: SqlDatabase,
  input: CreateSavedItemInput
): Promise<SavedItem> {
  const item: SavedItem = {
    id: input.id ?? createId(),
    instagramUrl: input.instagramUrl,
    instagramShortcode: input.instagramShortcode,
    mediaType: input.mediaType ?? 'unknown',
    authorUsername: input.authorUsername,
    caption: input.caption,
    thumbnailUrl: input.thumbnailUrl,
    collectionId: input.collectionId,
    savedAt: input.savedAt ?? new Date().toISOString(),
    status: 'active',
    previewStatus: input.previewStatus ?? 'pending',
  };

  await db.runAsync(
    `INSERT INTO saved_items (
       id, instagram_url, instagram_shortcode, media_type, author_username, caption,
       thumbnail_url, cached_thumbnail_path, collection_id, saved_at, reminder_at,
       status, preview_status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.instagramUrl,
      nullable(item.instagramShortcode),
      item.mediaType,
      nullable(item.authorUsername),
      nullable(item.caption),
      nullable(item.thumbnailUrl),
      null,
      nullable(item.collectionId),
      item.savedAt,
      null,
      item.status,
      item.previewStatus,
    ]
  );

  return item;
}

export async function getSavedItem(db: SqlDatabase, id: string): Promise<SavedItem | null> {
  const row = await db.getFirstAsync<SavedItemRow>(`${SELECT_ITEM} WHERE id = ?`, [id]);
  return row ? toSavedItem(row) : null;
}

/**
 * Looks an item up by its normalised URL. Used to detect duplicates before saving,
 * per plan §19 (normalised URL is part of duplicate detection).
 */
export async function findSavedItemByUrl(
  db: SqlDatabase,
  normalizedUrl: string
): Promise<SavedItem | null> {
  const row = await db.getFirstAsync<SavedItemRow>(`${SELECT_ITEM} WHERE instagram_url = ?`, [
    normalizedUrl,
  ]);
  return row ? toSavedItem(row) : null;
}

export async function listSavedItems(
  db: SqlDatabase,
  options: { includeArchived?: boolean; limit?: number } = {}
): Promise<SavedItem[]> {
  const where = options.includeArchived ? '' : " WHERE status != 'archived'";
  const limit = options.limit ? ` LIMIT ${Number(options.limit)}` : '';
  const rows = await db.getAllAsync<SavedItemRow>(
    `${SELECT_ITEM}${where} ORDER BY saved_at DESC${limit}`
  );
  return rows.map(toSavedItem);
}

export async function listSavedItemsByCollection(
  db: SqlDatabase,
  collectionId: string | null
): Promise<SavedItem[]> {
  const rows =
    collectionId === null
      ? await db.getAllAsync<SavedItemRow>(
          `${SELECT_ITEM} WHERE collection_id IS NULL AND status != 'archived' ORDER BY saved_at DESC`
        )
      : await db.getAllAsync<SavedItemRow>(
          `${SELECT_ITEM} WHERE collection_id = ? AND status != 'archived' ORDER BY saved_at DESC`,
          [collectionId]
        );
  return rows.map(toSavedItem);
}

/**
 * Items with a reminder still in the future, soonest first.
 * `now` is injected so the query is deterministic in tests.
 */
export async function listUpcomingItems(
  db: SqlDatabase,
  now: string,
  limit = 10
): Promise<SavedItem[]> {
  const rows = await db.getAllAsync<SavedItemRow>(
    `${SELECT_ITEM}
     WHERE reminder_at IS NOT NULL AND reminder_at >= ? AND status = 'active'
     ORDER BY reminder_at ASC LIMIT ${Number(limit)}`,
    [now]
  );
  return rows.map(toSavedItem);
}

/** Items whose reminder time has passed but which were never completed. */
export async function listOverdueItems(db: SqlDatabase, now: string): Promise<SavedItem[]> {
  const rows = await db.getAllAsync<SavedItemRow>(
    `${SELECT_ITEM}
     WHERE reminder_at IS NOT NULL AND reminder_at < ? AND status = 'active'
     ORDER BY reminder_at DESC`,
    [now]
  );
  return rows.map(toSavedItem);
}

/** Items whose preview has not resolved yet, oldest first so the queue is fair. */
export async function listItemsNeedingPreview(db: SqlDatabase, limit = 20): Promise<SavedItem[]> {
  const rows = await db.getAllAsync<SavedItemRow>(
    `${SELECT_ITEM} WHERE preview_status = 'pending' ORDER BY saved_at ASC LIMIT ${Number(limit)}`
  );
  return rows.map(toSavedItem);
}

export async function applyPreview(
  db: SqlDatabase,
  id: string,
  patch: PreviewPatch
): Promise<void> {
  await db.runAsync(
    `UPDATE saved_items SET
       media_type = COALESCE(?, media_type),
       author_username = COALESCE(?, author_username),
       caption = COALESCE(?, caption),
       thumbnail_url = COALESCE(?, thumbnail_url),
       cached_thumbnail_path = COALESCE(?, cached_thumbnail_path),
       preview_status = ?
     WHERE id = ?`,
    [
      nullable(patch.mediaType),
      nullable(patch.authorUsername),
      nullable(patch.caption),
      nullable(patch.thumbnailUrl),
      nullable(patch.cachedThumbnailPath),
      patch.previewStatus,
      id,
    ]
  );
}

export async function setItemCollection(
  db: SqlDatabase,
  id: string,
  collectionId: string | null
): Promise<void> {
  await db.runAsync('UPDATE saved_items SET collection_id = ? WHERE id = ?', [collectionId, id]);
}

export async function setItemStatus(
  db: SqlDatabase,
  id: string,
  status: SavedItemStatus
): Promise<void> {
  await db.runAsync('UPDATE saved_items SET status = ? WHERE id = ?', [status, id]);
}

/** Keeps the denormalised `reminder_at` column in step with the reminders table. */
export async function setItemReminderAt(
  db: SqlDatabase,
  id: string,
  reminderAt: string | null
): Promise<void> {
  await db.runAsync('UPDATE saved_items SET reminder_at = ? WHERE id = ?', [reminderAt, id]);
}

export async function setCachedThumbnailPath(
  db: SqlDatabase,
  id: string,
  path: string | null
): Promise<void> {
  await db.runAsync('UPDATE saved_items SET cached_thumbnail_path = ? WHERE id = ?', [path, id]);
}

/** Deletes the item. Reminders are removed by the schema's `ON DELETE CASCADE`. */
export async function deleteSavedItem(db: SqlDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM saved_items WHERE id = ?', [id]);
}

export async function searchSavedItems(
  db: SqlDatabase,
  query: string,
  filter: SavedItemFilter,
  now: string
): Promise<SavedItem[]> {
  const clauses: string[] = ["status != 'archived'"];
  const params: SqlValue[] = [];

  const trimmed = query.trim();
  if (trimmed.length > 0) {
    clauses.push(
      `(author_username LIKE ? OR caption LIKE ? OR collection_id IN
         (SELECT id FROM collections WHERE name LIKE ?))`
    );
    const like = `%${trimmed}%`;
    params.push(like, like, like);
  }

  switch (filter) {
    case 'upcoming':
      clauses.push('reminder_at IS NOT NULL AND reminder_at >= ?');
      params.push(now);
      break;
    case 'overdue':
      clauses.push('reminder_at IS NOT NULL AND reminder_at < ?');
      params.push(now);
      break;
    case 'completed':
      clauses.push("status = 'completed'");
      break;
    case 'no-reminder':
      clauses.push('reminder_at IS NULL');
      break;
    case 'all':
      break;
  }

  const rows = await db.getAllAsync<SavedItemRow>(
    `${SELECT_ITEM} WHERE ${clauses.join(' AND ')} ORDER BY saved_at DESC`,
    params
  );
  return rows.map(toSavedItem);
}

export async function countSavedItems(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM saved_items WHERE status != 'archived'"
  );
  return row?.total ?? 0;
}
