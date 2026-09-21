import type { SqlDatabase } from '../adapter';
import { type ReminderRow, type SavedItemRow, toReminder, toSavedItem } from '../mappers';

import type { Reminder, ReminderRepeat, ReminderWithItem } from '@/types/domain';
import { createId } from '@/utils/id';

export type CreateReminderInput = {
  savedItemId: string;
  scheduledAt: string;
  notificationId?: string;
  repeat?: ReminderRepeat;
  note?: string;
  id?: string;
};

export async function createReminder(db: SqlDatabase, input: CreateReminderInput): Promise<Reminder> {
  const reminder: Reminder = {
    id: input.id ?? createId(),
    savedItemId: input.savedItemId,
    scheduledAt: input.scheduledAt,
    notificationId: input.notificationId,
    status: 'scheduled',
    repeat: input.repeat ?? 'once',
    note: input.note?.trim() || undefined,
  };

  await db.runAsync(
    `INSERT INTO reminders
       (id, saved_item_id, scheduled_at, notification_id, completed_at, status, repeat, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reminder.id,
      reminder.savedItemId,
      reminder.scheduledAt,
      reminder.notificationId ?? null,
      null,
      reminder.status,
      reminder.repeat,
      reminder.note ?? null,
    ]
  );

  return reminder;
}

export async function getReminder(db: SqlDatabase, id: string): Promise<Reminder | null> {
  const row = await db.getFirstAsync<ReminderRow>('SELECT * FROM reminders WHERE id = ?', [id]);
  return row ? toReminder(row) : null;
}

export async function listRemindersForItem(db: SqlDatabase, savedItemId: string): Promise<Reminder[]> {
  const rows = await db.getAllAsync<ReminderRow>(
    'SELECT * FROM reminders WHERE saved_item_id = ? ORDER BY scheduled_at DESC',
    [savedItemId]
  );
  return rows.map(toReminder);
}

/** Every reminder still waiting to fire for an item, soonest first. */
export async function listScheduledRemindersForItem(
  db: SqlDatabase,
  savedItemId: string
): Promise<Reminder[]> {
  const rows = await db.getAllAsync<ReminderRow>(
    `SELECT * FROM reminders
     WHERE saved_item_id = ? AND status = 'scheduled'
     ORDER BY scheduled_at ASC`,
    [savedItemId]
  );
  return rows.map(toReminder);
}

export async function listAllScheduledReminders(db: SqlDatabase): Promise<Reminder[]> {
  const rows = await db.getAllAsync<ReminderRow>(
    "SELECT * FROM reminders WHERE status = 'scheduled' ORDER BY scheduled_at ASC"
  );
  return rows.map(toReminder);
}

/**
 * Scheduled reminders on active items, each with its item, soonest first.
 *
 * Two queries rather than a join, so both halves reuse their existing row mappers and no
 * column names collide.
 */
export async function listActiveRemindersWithItems(db: SqlDatabase): Promise<ReminderWithItem[]> {
  const reminders = (
    await db.getAllAsync<ReminderRow>(
      "SELECT * FROM reminders WHERE status = 'scheduled' ORDER BY scheduled_at ASC"
    )
  ).map(toReminder);

  if (reminders.length === 0) {
    return [];
  }

  const ids = [...new Set(reminders.map((reminder) => reminder.savedItemId))];
  const placeholders = ids.map(() => '?').join(', ');
  const items = (
    await db.getAllAsync<SavedItemRow>(
      `SELECT * FROM saved_items WHERE id IN (${placeholders}) AND status = 'active'`,
      ids
    )
  ).map(toSavedItem);

  const byId = new Map(items.map((item) => [item.id, item]));
  return reminders.flatMap((reminder) => {
    const item = byId.get(reminder.savedItemId);
    return item ? [{ reminder, item }] : [];
  });
}

/** The next reminder for an item, used to refresh `saved_items.reminder_at`. */
export async function getNextScheduledReminder(
  db: SqlDatabase,
  savedItemId: string
): Promise<Reminder | null> {
  const row = await db.getFirstAsync<ReminderRow>(
    `SELECT * FROM reminders
     WHERE saved_item_id = ? AND status = 'scheduled'
     ORDER BY scheduled_at ASC LIMIT 1`,
    [savedItemId]
  );
  return row ? toReminder(row) : null;
}

export async function setReminderNotificationId(
  db: SqlDatabase,
  id: string,
  notificationId: string | null
): Promise<void> {
  await db.runAsync('UPDATE reminders SET notification_id = ? WHERE id = ?', [notificationId, id]);
}

export async function setReminderRepeat(db: SqlDatabase, id: string, repeat: ReminderRepeat): Promise<void> {
  await db.runAsync('UPDATE reminders SET repeat = ? WHERE id = ?', [repeat, id]);
}

export async function setReminderNote(db: SqlDatabase, id: string, note: string | null): Promise<void> {
  await db.runAsync('UPDATE reminders SET note = ? WHERE id = ?', [note?.trim() || null, id]);
}

export async function setReminderScheduledAt(db: SqlDatabase, id: string, scheduledAt: string): Promise<void> {
  await db.runAsync('UPDATE reminders SET scheduled_at = ? WHERE id = ?', [scheduledAt, id]);
}

export async function completeReminder(db: SqlDatabase, id: string, completedAt: string): Promise<void> {
  await db.runAsync("UPDATE reminders SET status = 'completed', completed_at = ? WHERE id = ?", [
    completedAt,
    id,
  ]);
}

export async function cancelReminder(db: SqlDatabase, id: string): Promise<void> {
  await db.runAsync("UPDATE reminders SET status = 'cancelled' WHERE id = ?", [id]);
}

export async function cancelRemindersForItem(db: SqlDatabase, savedItemId: string): Promise<void> {
  await db.runAsync(
    "UPDATE reminders SET status = 'cancelled' WHERE saved_item_id = ? AND status = 'scheduled'",
    [savedItemId]
  );
}
