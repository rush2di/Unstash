import { beforeEach, describe, expect, it } from 'vitest';

import { createNodeDatabase, createTestDatabase } from '../helpers/node-sqlite';

import type { SqlDatabase } from '@/db/adapter';
import { migrate } from '@/db/migrate';
import { LATEST_VERSION } from '@/db/migrations';
import {
  createCollection,
  createReminder,
  createSavedItem,
  getAllSettings,
  getCollection,
  getReminder,
  getSavedItem,
  listActiveRemindersWithItems,
  setItemStatus,
  setReminderNote,
  setReminderRepeat,
  setSetting,
  updateCollection,
} from '@/db/repositories';
import { rollRepeatingReminders } from '@/features/reminders/service';
import { SCHEMA_V1 } from '@/db/schema';

const URL_A = 'https://www.instagram.com/p/AAA111/';
const URL_B = 'https://www.instagram.com/p/BBB222/';

describe('upgrade from v1', () => {
  it('keeps existing rows and adds v2 columns with defaults', async () => {
    // A database exactly as a v1 install left it.
    const db = createNodeDatabase();
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await db.execAsync(SCHEMA_V1);
    await db.execAsync('PRAGMA user_version = 1');
    await db.runAsync('INSERT INTO collections (id, name, created_at) VALUES (?, ?, ?)', ['c1', 'Ideas', '2026-09-20T00:00:00.000Z']);
    await db.runAsync(
      `INSERT INTO saved_items (id, instagram_url, media_type, saved_at, status, preview_status)
       VALUES (?, ?, 'image', ?, 'active', 'available')`,
      ['i1', URL_A, '2026-09-20T00:00:00.000Z']
    );
    await db.runAsync(
      `INSERT INTO reminders (id, saved_item_id, scheduled_at, status) VALUES (?, ?, ?, 'scheduled')`,
      ['r1', 'i1', '2026-09-22T09:00:00.000Z']
    );

    await expect(migrate(db)).resolves.toBe(LATEST_VERSION);

    expect((await getSavedItem(db, 'i1'))?.instagramUrl).toBe(URL_A);
    const collection = await getCollection(db, 'c1');
    expect(collection).toMatchObject({ name: 'Ideas', emoji: undefined, color: undefined });
    const reminder = await getReminder(db, 'r1');
    expect(reminder).toMatchObject({ repeat: 'once', note: undefined, status: 'scheduled' });
    expect(await getAllSettings(db)).toEqual({});
  });
});

let db: SqlDatabase & { close: () => void };

beforeEach(async () => {
  db = await createTestDatabase();
});

describe('collection appearance', () => {
  it('stores and updates emoji and colour', async () => {
    const created = await createCollection(db, { name: 'Recipes', emoji: '🍜', color: 'rose' });
    expect(await getCollection(db, created.id)).toMatchObject({ emoji: '🍜', color: 'rose' });

    await updateCollection(db, created.id, { name: 'Dinner', emoji: '🍝', color: 'amber' });
    expect(await getCollection(db, created.id)).toMatchObject({ name: 'Dinner', emoji: '🍝', color: 'amber' });
  });

  it('ignores an unknown colour stored in the row', async () => {
    const created = await createCollection(db, { name: 'X' });
    await db.runAsync("UPDATE collections SET color = 'neon' WHERE id = ?", [created.id]);
    expect((await getCollection(db, created.id))?.color).toBeUndefined();
  });
});

describe('reminder repeat and note', () => {
  it('stores repeat and note', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    const reminder = await createReminder(db, {
      savedItemId: item.id,
      scheduledAt: '2026-09-22T09:00:00.000Z',
      repeat: 'weekly',
      note: '  Check dimensions before buying  ',
    });

    expect(await getReminder(db, reminder.id)).toMatchObject({ repeat: 'weekly', note: 'Check dimensions before buying' });

    await setReminderRepeat(db, reminder.id, 'daily');
    await setReminderNote(db, reminder.id, '');
    expect(await getReminder(db, reminder.id)).toMatchObject({ repeat: 'daily', note: undefined });
  });
});

describe('listActiveRemindersWithItems', () => {
  it('pairs scheduled reminders with active items, soonest first', async () => {
    const a = await createSavedItem(db, { instagramUrl: URL_A });
    const b = await createSavedItem(db, { instagramUrl: URL_B });
    await createReminder(db, { savedItemId: a.id, scheduledAt: '2026-09-25T09:00:00.000Z' });
    await createReminder(db, { savedItemId: b.id, scheduledAt: '2026-09-22T09:00:00.000Z' });

    const list = await listActiveRemindersWithItems(db);
    expect(list.map((entry) => entry.item.id)).toEqual([b.id, a.id]);
  });

  it('leaves out reminders on archived items', async () => {
    const a = await createSavedItem(db, { instagramUrl: URL_A });
    await createReminder(db, { savedItemId: a.id, scheduledAt: '2026-09-25T09:00:00.000Z' });
    await setItemStatus(db, a.id, 'archived');

    expect(await listActiveRemindersWithItems(db)).toEqual([]);
  });
});

describe('settings repository', () => {
  it('upserts values', async () => {
    await setSetting(db, 'haptics', 'true');
    await setSetting(db, 'haptics', 'false');
    expect(await getAllSettings(db)).toEqual({ haptics: 'false' });
  });
});

describe('rollRepeatingReminders', () => {
  it('moves a missed daily reminder forward and updates the item', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    const past = new Date(2026, 8, 18, 9, 0, 0, 0);
    const reminder = await createReminder(db, { savedItemId: item.id, scheduledAt: past.toISOString(), repeat: 'daily' });

    const now = new Date(2026, 8, 21, 12, 0, 0, 0);
    expect(await rollRepeatingReminders(db, now)).toBe(1);

    const moved = new Date((await getReminder(db, reminder.id))!.scheduledAt);
    expect(moved.getTime()).toBeGreaterThan(now.getTime());
    expect(moved.getHours()).toBe(9);
    expect((await getSavedItem(db, item.id))?.reminderAt).toBe(moved.toISOString());
  });

  it('leaves missed one-off reminders overdue', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    const past = new Date(2026, 8, 18, 9).toISOString();
    const reminder = await createReminder(db, { savedItemId: item.id, scheduledAt: past });

    expect(await rollRepeatingReminders(db, new Date(2026, 8, 21, 12))).toBe(0);
    expect((await getReminder(db, reminder.id))?.scheduledAt).toBe(past);
  });
});
