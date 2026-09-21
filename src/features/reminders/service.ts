import { isRepeating, nextOccurrence } from './repeat';

import type { SqlDatabase } from '@/db/adapter';
import {
  cancelReminder,
  cancelRemindersForItem,
  completeReminder,
  createReminder,
  getNextScheduledReminder,
  listAllScheduledReminders,
  listScheduledRemindersForItem,
  setItemReminderAt,
  setReminderScheduledAt,
} from '@/db/repositories';
import type { Reminder, ReminderRepeat } from '@/types/domain';

/**
 * Reminder writes that keep the `reminders` table and the denormalised
 * `saved_items.reminder_at` column consistent.
 *
 * OS notification scheduling is layered on top of these functions in `./scheduler.ts`;
 * this module owns the data only, so it stays testable off device.
 */

/** Refreshes `saved_items.reminder_at` from whatever is still scheduled. */
export async function syncItemReminderAt(db: SqlDatabase, savedItemId: string): Promise<void> {
  const next = await getNextScheduledReminder(db, savedItemId);
  await setItemReminderAt(db, savedItemId, next?.scheduledAt ?? null);
}

export async function addReminder(
  db: SqlDatabase,
  savedItemId: string,
  scheduledAt: Date,
  repeat: ReminderRepeat = 'once',
  note?: string
): Promise<Reminder> {
  const reminder = await createReminder(db, {
    savedItemId,
    scheduledAt: scheduledAt.toISOString(),
    repeat,
    note,
  });
  await syncItemReminderAt(db, savedItemId);
  return reminder;
}

/** Replaces every scheduled reminder on an item with a single new one. */
export async function replaceReminder(
  db: SqlDatabase,
  savedItemId: string,
  scheduledAt: Date,
  repeat: ReminderRepeat = 'once',
  note?: string
): Promise<Reminder> {
  await cancelRemindersForItem(db, savedItemId);
  return addReminder(db, savedItemId, scheduledAt, repeat, note);
}

export async function clearReminders(db: SqlDatabase, savedItemId: string): Promise<void> {
  await cancelRemindersForItem(db, savedItemId);
  await syncItemReminderAt(db, savedItemId);
}

export async function markReminderComplete(
  db: SqlDatabase,
  reminderId: string,
  savedItemId: string,
  completedAt: Date = new Date()
): Promise<void> {
  await completeReminder(db, reminderId, completedAt.toISOString());
  await syncItemReminderAt(db, savedItemId);
}

export async function cancelSingleReminder(
  db: SqlDatabase,
  reminderId: string,
  savedItemId: string
): Promise<void> {
  await cancelReminder(db, reminderId);
  await syncItemReminderAt(db, savedItemId);
}

/**
 * Moves every repeating reminder whose time has passed to its next occurrence.
 *
 * Run on every refresh, so a repeating reminder never shows as overdue and the item's
 * `reminder_at` always points at the next real firing. One-off reminders are left alone:
 * a missed one-off reminder is overdue.
 *
 * Returns the number of reminders moved.
 */
export async function rollRepeatingReminders(db: SqlDatabase, now: Date = new Date()): Promise<number> {
  const scheduled = await listAllScheduledReminders(db);
  let moved = 0;

  for (const reminder of scheduled) {
    if (!isRepeating(reminder.repeat)) {
      continue;
    }
    const current = new Date(reminder.scheduledAt);
    const next = nextOccurrence(current, reminder.repeat, now);
    if (next.getTime() !== current.getTime()) {
      await setReminderScheduledAt(db, reminder.id, next.toISOString());
      await syncItemReminderAt(db, reminder.savedItemId);
      moved += 1;
    }
  }

  return moved;
}

export { listScheduledRemindersForItem };
