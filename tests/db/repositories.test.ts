import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDatabase } from '../helpers/node-sqlite';

import type { SqlDatabase } from '@/db/adapter';
import { LATEST_VERSION } from '@/db/migrations';
import {
  applyPreview,
  cancelRemindersForItem,
  completeReminder,
  countSavedItems,
  createCollection,
  createReminder,
  createSavedItem,
  deleteCollection,
  deleteSavedItem,
  findSavedItemByUrl,
  getCollection,
  getNextScheduledReminder,
  getSavedItem,
  listCollectionsWithCounts,
  listItemsNeedingPreview,
  listOverdueItems,
  listRemindersForItem,
  listSavedItems,
  listSavedItemsByCollection,
  listUpcomingItems,
  renameCollection,
  searchSavedItems,
  setItemCollection,
  setItemReminderAt,
  setItemStatus,
} from '@/db/repositories';

const NOW = '2026-09-20T12:00:00.000Z';
const URL_A = 'https://www.instagram.com/p/AAA111/';
const URL_B = 'https://www.instagram.com/reel/BBB222/';

let db: SqlDatabase & { close: () => void };

beforeEach(async () => {
  db = await createTestDatabase();
});

describe('migrations', () => {
  it('records the latest schema version', async () => {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(LATEST_VERSION);
  });

  it('is idempotent when run twice', async () => {
    const { migrate } = await import('@/db/migrate');
    await expect(migrate(db)).resolves.toBe(LATEST_VERSION);
  });
});

describe('saved items', () => {
  it('creates and reads an item back', async () => {
    const created = await createSavedItem(db, {
      instagramUrl: URL_A,
      instagramShortcode: 'AAA111',
      mediaType: 'image',
      savedAt: NOW,
    });

    const found = await getSavedItem(db, created.id);
    expect(found).not.toBeNull();
    expect(found?.instagramUrl).toBe(URL_A);
    expect(found?.instagramShortcode).toBe('AAA111');
    expect(found?.mediaType).toBe('image');
    expect(found?.status).toBe('active');
    expect(found?.previewStatus).toBe('pending');
    expect(found?.reminderAt).toBeUndefined();
  });

  it('generates a UUID when no id is supplied', async () => {
    const created = await createSavedItem(db, { instagramUrl: URL_A });
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('finds an item by its normalised URL', async () => {
    await createSavedItem(db, { instagramUrl: URL_A });
    expect(await findSavedItemByUrl(db, URL_A)).not.toBeNull();
    expect(await findSavedItemByUrl(db, URL_B)).toBeNull();
  });

  it('lists newest first and hides archived items', async () => {
    await createSavedItem(db, { instagramUrl: URL_A, savedAt: '2026-09-01T00:00:00.000Z' });
    const newer = await createSavedItem(db, {
      instagramUrl: URL_B,
      savedAt: '2026-09-10T00:00:00.000Z',
    });

    const items = await listSavedItems(db);
    expect(items.map((item) => item.instagramUrl)).toEqual([URL_B, URL_A]);

    await setItemStatus(db, newer.id, 'archived');
    expect(await listSavedItems(db)).toHaveLength(1);
    expect(await listSavedItems(db, { includeArchived: true })).toHaveLength(2);
  });

  it('applies a preview patch without overwriting fields left out', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A, authorUsername: 'original' });

    await applyPreview(db, item.id, {
      caption: 'a caption',
      thumbnailUrl: 'https://cdn.example/x.jpg',
      previewStatus: 'available',
    });

    const updated = await getSavedItem(db, item.id);
    expect(updated?.authorUsername).toBe('original');
    expect(updated?.caption).toBe('a caption');
    expect(updated?.previewStatus).toBe('available');
  });

  it('records a failed preview', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    await applyPreview(db, item.id, { previewStatus: 'failed' });
    expect((await getSavedItem(db, item.id))?.previewStatus).toBe('failed');
  });

  it('queues only pending previews, oldest first', async () => {
    const first = await createSavedItem(db, {
      instagramUrl: URL_A,
      savedAt: '2026-09-01T00:00:00.000Z',
    });
    await createSavedItem(db, { instagramUrl: URL_B, savedAt: '2026-09-02T00:00:00.000Z' });
    await applyPreview(db, first.id, { previewStatus: 'available' });

    const queue = await listItemsNeedingPreview(db);
    expect(queue.map((item) => item.instagramUrl)).toEqual([URL_B]);
  });

  it('counts only non-archived items', async () => {
    const a = await createSavedItem(db, { instagramUrl: URL_A });
    await createSavedItem(db, { instagramUrl: URL_B });
    await setItemStatus(db, a.id, 'archived');
    expect(await countSavedItems(db)).toBe(1);
  });

  it('deletes an item', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    await deleteSavedItem(db, item.id);
    expect(await getSavedItem(db, item.id)).toBeNull();
  });
});

describe('collections', () => {
  it('creates, renames and reads a collection', async () => {
    const collection = await createCollection(db, { name: '  Ideas  ', createdAt: NOW });
    expect(collection.name).toBe('Ideas');

    await renameCollection(db, collection.id, 'Inspiration');
    expect((await getCollection(db, collection.id))?.name).toBe('Inspiration');
  });

  it('counts the items in each collection', async () => {
    const ideas = await createCollection(db, { name: 'Ideas' });
    const empty = await createCollection(db, { name: 'Empty' });
    await createSavedItem(db, { instagramUrl: URL_A, collectionId: ideas.id });
    await createSavedItem(db, { instagramUrl: URL_B, collectionId: ideas.id });

    const counts = await listCollectionsWithCounts(db);
    const byName = Object.fromEntries(counts.map((c) => [c.name, c.itemCount]));
    expect(byName).toEqual({ Ideas: 2, Empty: 0 });
  });

  it('excludes archived items from the count', async () => {
    const ideas = await createCollection(db, { name: 'Ideas' });
    const item = await createSavedItem(db, { instagramUrl: URL_A, collectionId: ideas.id });
    await setItemStatus(db, item.id, 'archived');

    const counts = await listCollectionsWithCounts(db);
    expect(counts[0].itemCount).toBe(0);
  });

  it('moves items back to "All saved" when the collection is deleted', async () => {
    const ideas = await createCollection(db, { name: 'Ideas' });
    const item = await createSavedItem(db, { instagramUrl: URL_A, collectionId: ideas.id });

    await deleteCollection(db, ideas.id);

    const survivor = await getSavedItem(db, item.id);
    expect(survivor).not.toBeNull();
    expect(survivor?.collectionId).toBeUndefined();
  });

  it('lists items by collection, including the uncollected ones', async () => {
    const ideas = await createCollection(db, { name: 'Ideas' });
    await createSavedItem(db, { instagramUrl: URL_A, collectionId: ideas.id });
    await createSavedItem(db, { instagramUrl: URL_B });

    expect(await listSavedItemsByCollection(db, ideas.id)).toHaveLength(1);
    expect(await listSavedItemsByCollection(db, null)).toHaveLength(1);
  });

  it('moves an item between collections', async () => {
    const a = await createCollection(db, { name: 'A' });
    const b = await createCollection(db, { name: 'B' });
    const item = await createSavedItem(db, { instagramUrl: URL_A, collectionId: a.id });

    await setItemCollection(db, item.id, b.id);
    expect((await getSavedItem(db, item.id))?.collectionId).toBe(b.id);

    await setItemCollection(db, item.id, null);
    expect((await getSavedItem(db, item.id))?.collectionId).toBeUndefined();
  });
});

describe('reminders', () => {
  it('creates a reminder linked to an item', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    const reminder = await createReminder(db, {
      savedItemId: item.id,
      scheduledAt: '2026-09-21T19:00:00.000Z',
      notificationId: 'notif-1',
    });

    const reminders = await listRemindersForItem(db, item.id);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).toBe(reminder.id);
    expect(reminders[0].notificationId).toBe('notif-1');
    expect(reminders[0].status).toBe('scheduled');
  });

  it('rejects a reminder for an item that does not exist', async () => {
    await expect(
      createReminder(db, { savedItemId: 'missing', scheduledAt: NOW })
    ).rejects.toThrow();
  });

  it('returns the soonest scheduled reminder', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    await createReminder(db, { savedItemId: item.id, scheduledAt: '2026-10-01T10:00:00.000Z' });
    const sooner = await createReminder(db, {
      savedItemId: item.id,
      scheduledAt: '2026-09-25T10:00:00.000Z',
    });

    expect((await getNextScheduledReminder(db, item.id))?.id).toBe(sooner.id);
  });

  it('completes a reminder without changing the item status', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    const reminder = await createReminder(db, { savedItemId: item.id, scheduledAt: NOW });

    await completeReminder(db, reminder.id, NOW);

    const reminders = await listRemindersForItem(db, item.id);
    expect(reminders[0].status).toBe('completed');
    expect(reminders[0].completedAt).toBe(NOW);
    expect((await getSavedItem(db, item.id))?.status).toBe('active');
    expect(await getNextScheduledReminder(db, item.id)).toBeNull();
  });

  it('cancels every scheduled reminder for an item', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    await createReminder(db, { savedItemId: item.id, scheduledAt: NOW });
    await createReminder(db, { savedItemId: item.id, scheduledAt: '2026-10-01T10:00:00.000Z' });

    await cancelRemindersForItem(db, item.id);

    const reminders = await listRemindersForItem(db, item.id);
    expect(reminders.every((reminder) => reminder.status === 'cancelled')).toBe(true);
  });

  it('cascades reminder deletion when the item is deleted', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    await createReminder(db, { savedItemId: item.id, scheduledAt: NOW });

    await deleteSavedItem(db, item.id);

    expect(await listRemindersForItem(db, item.id)).toHaveLength(0);
  });

  it('separates upcoming from overdue items', async () => {
    const upcoming = await createSavedItem(db, { instagramUrl: URL_A });
    const overdue = await createSavedItem(db, { instagramUrl: URL_B });
    await setItemReminderAt(db, upcoming.id, '2026-09-21T10:00:00.000Z');
    await setItemReminderAt(db, overdue.id, '2026-09-19T10:00:00.000Z');

    expect((await listUpcomingItems(db, NOW)).map((i) => i.id)).toEqual([upcoming.id]);
    expect((await listOverdueItems(db, NOW)).map((i) => i.id)).toEqual([overdue.id]);
  });
});

describe('search and filtering', () => {
  it('matches on username, caption and collection name', async () => {
    const ideas = await createCollection(db, { name: 'Woodworking' });
    await createSavedItem(db, { instagramUrl: URL_A, authorUsername: 'carpenter' });
    await createSavedItem(db, {
      instagramUrl: URL_B,
      caption: 'a nice dovetail joint',
      collectionId: ideas.id,
    });

    expect(await searchSavedItems(db, 'carpenter', 'all', NOW)).toHaveLength(1);
    expect(await searchSavedItems(db, 'dovetail', 'all', NOW)).toHaveLength(1);
    expect(await searchSavedItems(db, 'Woodworking', 'all', NOW)).toHaveLength(1);
    expect(await searchSavedItems(db, 'nothing matches', 'all', NOW)).toHaveLength(0);
  });

  it('applies the reminder filters', async () => {
    const upcoming = await createSavedItem(db, { instagramUrl: URL_A });
    const overdue = await createSavedItem(db, { instagramUrl: URL_B });
    const none = await createSavedItem(db, { instagramUrl: 'https://www.instagram.com/p/CCC333/' });
    await setItemReminderAt(db, upcoming.id, '2026-09-21T10:00:00.000Z');
    await setItemReminderAt(db, overdue.id, '2026-09-19T10:00:00.000Z');

    expect((await searchSavedItems(db, '', 'upcoming', NOW)).map((i) => i.id)).toEqual([
      upcoming.id,
    ]);
    expect((await searchSavedItems(db, '', 'overdue', NOW)).map((i) => i.id)).toEqual([overdue.id]);
    expect((await searchSavedItems(db, '', 'no-reminder', NOW)).map((i) => i.id)).toEqual([none.id]);
    expect(await searchSavedItems(db, '', 'all', NOW)).toHaveLength(3);
  });
});
