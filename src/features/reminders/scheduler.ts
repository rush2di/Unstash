import { addReminder, cancelSingleReminder, clearReminders, markReminderComplete } from './service';

import type { SqlDatabase } from '@/db/adapter';
import {
  getReminder,
  getSavedItem,
  listScheduledRemindersForItem,
  setReminderNote,
  setReminderNotificationId,
  setReminderRepeat,
} from '@/db/repositories';
import { cancelReminderNotification, scheduleReminderNotification } from '@/services/notifications';
import type { Reminder, ReminderRepeat } from '@/types/domain';

/**
 * Reminder operations that touch both the database and the OS scheduler.
 *
 * `service.ts` owns the data and stays free of native modules, so it can be tested off
 * device. This module adds the notification side on top.
 *
 * A reminder row is always written, even when the notification cannot be scheduled. The
 * app then still shows the reminder, which is better than losing the user's intent.
 */

export type SchedulerOptions = {
  /** The Notification Sound preference. */
  sound?: boolean;
};

async function cancelNotificationsForItem(db: SqlDatabase, savedItemId: string): Promise<void> {
  const scheduled = await listScheduledRemindersForItem(db, savedItemId);
  await Promise.all(scheduled.map((reminder) => cancelReminderNotification(reminder.notificationId)));
}

/** (Re)schedules the OS notification for one reminder row and stores its id. */
async function armNotification(db: SqlDatabase, reminder: Reminder, options: SchedulerOptions): Promise<Reminder> {
  const item = await getSavedItem(db, reminder.savedItemId);
  if (!item) {
    return reminder;
  }

  const notificationId = await scheduleReminderNotification(item, reminder.id, new Date(reminder.scheduledAt), {
    repeat: reminder.repeat,
    sound: options.sound,
  });
  await setReminderNotificationId(db, reminder.id, notificationId);
  return { ...reminder, notificationId: notificationId ?? undefined };
}

/** Creates a reminder and schedules its notification. */
export async function scheduleReminder(
  db: SqlDatabase,
  savedItemId: string,
  scheduledAt: Date,
  options: SchedulerOptions & { repeat?: ReminderRepeat; note?: string } = {}
): Promise<Reminder> {
  const reminder = await addReminder(db, savedItemId, scheduledAt, options.repeat, options.note);
  return armNotification(db, reminder, options);
}

/** Replaces every scheduled reminder on an item with one new reminder. */
export async function rescheduleReminder(
  db: SqlDatabase,
  savedItemId: string,
  scheduledAt: Date,
  options: SchedulerOptions & { repeat?: ReminderRepeat; note?: string } = {}
): Promise<Reminder> {
  await cancelNotificationsForItem(db, savedItemId);
  await clearReminders(db, savedItemId);
  return scheduleReminder(db, savedItemId, scheduledAt, options);
}

/** Changes how often a reminder fires, replacing its OS notification. */
export async function changeReminderRepeat(
  db: SqlDatabase,
  reminderId: string,
  repeat: ReminderRepeat,
  options: SchedulerOptions = {}
): Promise<void> {
  const reminder = await getReminder(db, reminderId);
  if (!reminder || reminder.repeat === repeat) {
    return;
  }
  await cancelReminderNotification(reminder.notificationId);
  await setReminderRepeat(db, reminderId, repeat);
  await armNotification(db, { ...reminder, repeat }, options);
}

export async function changeReminderNote(db: SqlDatabase, reminderId: string, note: string): Promise<void> {
  await setReminderNote(db, reminderId, note);
}

/** Cancels every reminder on an item, in the OS and in the database. */
export async function cancelAllReminders(db: SqlDatabase, savedItemId: string): Promise<void> {
  await cancelNotificationsForItem(db, savedItemId);
  await clearReminders(db, savedItemId);
}

export async function cancelOneReminder(db: SqlDatabase, reminderId: string, savedItemId: string): Promise<void> {
  const reminder = await getReminder(db, reminderId);
  await cancelReminderNotification(reminder?.notificationId);
  await cancelSingleReminder(db, reminderId, savedItemId);
}

/**
 * Marks a reminder complete. The notification is cancelled too: a reminder the user has
 * already acted on should not fire again.
 */
export async function completeReminderAndNotification(
  db: SqlDatabase,
  reminderId: string,
  savedItemId: string
): Promise<void> {
  const reminder = await getReminder(db, reminderId);
  await cancelReminderNotification(reminder?.notificationId);
  await markReminderComplete(db, reminderId, savedItemId);
}

/**
 * Completes every one-off reminder on an item that has come due. Repeating reminders keep
 * firing; "Done" on one of those only acknowledges this occurrence.
 */
export async function completeDueReminders(db: SqlDatabase, savedItemId: string): Promise<number> {
  const scheduled = await listScheduledRemindersForItem(db, savedItemId);
  const now = Date.now();
  const due = scheduled.filter(
    (reminder) => reminder.repeat === 'once' && new Date(reminder.scheduledAt).getTime() <= now
  );

  for (const reminder of due) {
    await completeReminderAndNotification(db, reminder.id, savedItemId);
  }
  return due.length;
}
