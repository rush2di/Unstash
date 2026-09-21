import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDatabase } from '../helpers/node-sqlite';

import type { SqlDatabase } from '@/db/adapter';
import { createSavedItem, getSavedItem, listRemindersForItem } from '@/db/repositories';
import {
  addReminder,
  cancelSingleReminder,
  clearReminders,
  markReminderComplete,
  replaceReminder,
  syncItemReminderAt,
} from '@/features/reminders/service';

const URL_A = 'https://www.instagram.com/p/AAA111/';

let db: SqlDatabase & { close: () => void };
let itemId: string;

const at = (iso: string) => new Date(iso);
const SOON = '2026-09-25T10:00:00.000Z';
const LATER = '2026-10-05T10:00:00.000Z';

beforeEach(async () => {
  db = await createTestDatabase();
  const item = await createSavedItem(db, { instagramUrl: URL_A });
  itemId = item.id;
});

describe('addReminder', () => {
  it('writes the reminder and mirrors it onto the item', async () => {
    const reminder = await addReminder(db, itemId, at(SOON));

    expect(reminder.status).toBe('scheduled');
    expect((await getSavedItem(db, itemId))?.reminderAt).toBe(SOON);
  });

  it('keeps the soonest reminder on the item when several exist', async () => {
    await addReminder(db, itemId, at(LATER));
    await addReminder(db, itemId, at(SOON));

    expect((await getSavedItem(db, itemId))?.reminderAt).toBe(SOON);
  });
});

describe('replaceReminder', () => {
  it('cancels the previous reminders and keeps only the new one', async () => {
    await addReminder(db, itemId, at(SOON));
    const replacement = await replaceReminder(db, itemId, at(LATER));

    const reminders = await listRemindersForItem(db, itemId);
    const scheduled = reminders.filter((reminder) => reminder.status === 'scheduled');

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].id).toBe(replacement.id);
    expect((await getSavedItem(db, itemId))?.reminderAt).toBe(LATER);
  });

  it('keeps the cancelled reminders as history', async () => {
    await addReminder(db, itemId, at(SOON));
    await replaceReminder(db, itemId, at(LATER));

    const reminders = await listRemindersForItem(db, itemId);
    expect(reminders).toHaveLength(2);
    expect(reminders.filter((reminder) => reminder.status === 'cancelled')).toHaveLength(1);
  });
});

describe('clearReminders', () => {
  it('cancels everything and clears the item reminder time', async () => {
    await addReminder(db, itemId, at(SOON));
    await addReminder(db, itemId, at(LATER));

    await clearReminders(db, itemId);

    const reminders = await listRemindersForItem(db, itemId);
    expect(reminders.every((reminder) => reminder.status === 'cancelled')).toBe(true);
    expect((await getSavedItem(db, itemId))?.reminderAt).toBeUndefined();
  });
});

describe('markReminderComplete', () => {
  it('completes the reminder and leaves the item active', async () => {
    const reminder = await addReminder(db, itemId, at(SOON));

    await markReminderComplete(db, reminder.id, itemId, at('2026-09-25T11:00:00.000Z'));

    const [stored] = await listRemindersForItem(db, itemId);
    expect(stored.status).toBe('completed');
    expect(stored.completedAt).toBe('2026-09-25T11:00:00.000Z');

    const item = await getSavedItem(db, itemId);
    expect(item?.status).toBe('active');
    expect(item?.reminderAt).toBeUndefined();
  });

  it('promotes the next reminder onto the item', async () => {
    const first = await addReminder(db, itemId, at(SOON));
    await addReminder(db, itemId, at(LATER));

    await markReminderComplete(db, first.id, itemId);

    expect((await getSavedItem(db, itemId))?.reminderAt).toBe(LATER);
  });
});

describe('cancelSingleReminder', () => {
  it('cancels one reminder and promotes the next', async () => {
    const first = await addReminder(db, itemId, at(SOON));
    await addReminder(db, itemId, at(LATER));

    await cancelSingleReminder(db, first.id, itemId);

    const reminders = await listRemindersForItem(db, itemId);
    expect(reminders.find((reminder) => reminder.id === first.id)?.status).toBe('cancelled');
    expect((await getSavedItem(db, itemId))?.reminderAt).toBe(LATER);
  });
});

describe('syncItemReminderAt', () => {
  it('is idempotent', async () => {
    await addReminder(db, itemId, at(SOON));

    await syncItemReminderAt(db, itemId);
    await syncItemReminderAt(db, itemId);

    expect((await getSavedItem(db, itemId))?.reminderAt).toBe(SOON);
  });

  it('clears the time when nothing is scheduled', async () => {
    await syncItemReminderAt(db, itemId);
    expect((await getSavedItem(db, itemId))?.reminderAt).toBeUndefined();
  });

  it('keeps a past reminder on the item so it can show as overdue', async () => {
    await addReminder(db, itemId, at('2020-01-01T00:00:00.000Z'));
    expect((await getSavedItem(db, itemId))?.reminderAt).toBe('2020-01-01T00:00:00.000Z');
  });
});
