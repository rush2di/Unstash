import type { SqlDatabase } from '../adapter';
import { type CollectionRow, type CollectionWithCountRow, toCollection, toCollectionWithCount } from '../mappers';

import type { Collection, CollectionColor, CollectionWithCount } from '@/types/domain';
import { createId } from '@/utils/id';

export type CollectionInput = {
  name: string;
  emoji?: string;
  color?: CollectionColor;
  id?: string;
  createdAt?: string;
};

export async function createCollection(db: SqlDatabase, input: CollectionInput): Promise<Collection> {
  const collection: Collection = {
    id: input.id ?? createId(),
    name: input.name.trim(),
    emoji: input.emoji?.trim() || undefined,
    color: input.color,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  await db.runAsync(
    'INSERT INTO collections (id, name, emoji, color, created_at) VALUES (?, ?, ?, ?, ?)',
    [
      collection.id,
      collection.name,
      collection.emoji ?? null,
      collection.color ?? null,
      collection.createdAt,
    ]
  );

  return collection;
}

export async function listCollections(db: SqlDatabase): Promise<Collection[]> {
  const rows = await db.getAllAsync<CollectionRow>(
    'SELECT * FROM collections ORDER BY created_at ASC'
  );
  return rows.map(toCollection);
}

/**
 * Collections with the number of non-archived items in each.
 * A collection with no items still appears, with a count of zero.
 */
export async function listCollectionsWithCounts(db: SqlDatabase): Promise<CollectionWithCount[]> {
  const rows = await db.getAllAsync<CollectionWithCountRow>(
    `SELECT c.*, COUNT(i.id) AS item_count
     FROM collections c
     LEFT JOIN saved_items i
       ON i.collection_id = c.id AND i.status != 'archived'
     GROUP BY c.id
     ORDER BY c.created_at ASC`
  );
  return rows.map(toCollectionWithCount);
}

export async function getCollection(db: SqlDatabase, id: string): Promise<Collection | null> {
  const row = await db.getFirstAsync<CollectionRow>('SELECT * FROM collections WHERE id = ?', [id]);
  return row ? toCollection(row) : null;
}

export async function renameCollection(db: SqlDatabase, id: string, name: string): Promise<void> {
  await db.runAsync('UPDATE collections SET name = ? WHERE id = ?', [name.trim(), id]);
}

/** Updates name, emoji and colour together, as the edit sheet saves them. */
export async function updateCollection(
  db: SqlDatabase,
  id: string,
  patch: { name: string; emoji?: string; color?: CollectionColor }
): Promise<void> {
  await db.runAsync('UPDATE collections SET name = ?, emoji = ?, color = ? WHERE id = ?', [
    patch.name.trim(),
    patch.emoji?.trim() || null,
    patch.color ?? null,
    id,
  ]);
}

/**
 * Deletes a collection. Items in it are not deleted; the schema's
 * `ON DELETE SET NULL` moves them back to "All saved".
 */
export async function deleteCollection(db: SqlDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM collections WHERE id = ?', [id]);
}
