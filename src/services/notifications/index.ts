import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { ReminderRepeat, SavedItem } from '@/types/domain';

/**
 * Local reminder notifications.
 *
 * Local only: there is no push server in the MVP. Every scheduled notification carries the
 * saved item id so a tap can deep link straight to it.
 */

export const REMINDERS_CHANNEL_ID = 'reminders';

/** Payload attached to every reminder notification. */
export type ReminderNotificationData = {
  savedItemId: string;
  reminderId: string;
};

export type PermissionState = 'granted' | 'denied' | 'undetermined';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Android needs an explicit channel before anything is scheduled. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 150, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

function toPermissionState(status: Notifications.PermissionStatus): PermissionState {
  if (status === 'granted') {
    return 'granted';
  }
  return status === 'undetermined' ? 'undetermined' : 'denied';
}

export async function getPermissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return toPermissionState(status);
}

/**
 * Asks for notification permission.
 *
 * Only prompts when the state is undetermined; once denied, the user has to change it in
 * system settings, and the app says so rather than prompting again.
 */
export async function requestPermission(): Promise<PermissionState> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') {
    await ensureAndroidChannel();
    return 'granted';
  }

  if (!existing.canAskAgain && existing.status !== 'undetermined') {
    return 'denied';
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });

  const state = toPermissionState(requested.status);
  if (state === 'granted') {
    await ensureAndroidChannel();
  }
  return state;
}

function notificationBody(item: SavedItem): string {
  if (item.authorUsername) {
    return `You saved something from @${item.authorUsername}. Tap to revisit it.`;
  }
  return 'You saved this on Instagram. Tap to revisit it.';
}

export type ScheduleOptions = {
  repeat?: ReminderRepeat;
  /** Honours the Notification Sound preference. */
  sound?: boolean;
};

/** Builds the OS trigger. Repeats keep the local time of day of the first occurrence. */
function triggerFor(scheduledAt: Date, repeat: ReminderRepeat): Notifications.NotificationTriggerInput {
  const hour = scheduledAt.getHours();
  const minute = scheduledAt.getMinutes();

  if (repeat === 'daily') {
    return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute };
  }
  if (repeat === 'weekly') {
    // JS weekdays are 0 = Sunday; expo-notifications uses 1 = Sunday.
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: scheduledAt.getDay() + 1,
      hour,
      minute,
    };
  }
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: scheduledAt };
}

/**
 * Schedules one reminder notification.
 *
 * Returns the notification id to store on the reminder row, or null when the reminder
 * cannot be scheduled: permission is missing, or a one-off time has already passed.
 */
export async function scheduleReminderNotification(
  item: SavedItem,
  reminderId: string,
  scheduledAt: Date,
  options: ScheduleOptions = {}
): Promise<string | null> {
  const repeat = options.repeat ?? 'once';

  // A repeating trigger is defined by time of day, so a past first occurrence is fine.
  if (repeat === 'once' && scheduledAt.getTime() <= Date.now()) {
    return null;
  }

  const permission = await getPermissionState();
  if (permission !== 'granted') {
    return null;
  }

  await ensureAndroidChannel();

  const data: ReminderNotificationData = { savedItemId: item.id, reminderId };

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔖 You wanted to revisit this',
        body: notificationBody(item),
        data,
        sound: options.sound ?? true,
        ...(Platform.OS === 'android' ? { channelId: REMINDERS_CHANNEL_ID } : {}),
      },
      trigger: triggerFor(scheduledAt, repeat),
    });
  } catch {
    // A reminder that cannot be scheduled still exists as data and shows in the app.
    return null;
  }
}

export async function cancelReminderNotification(notificationId: string | undefined): Promise<void> {
  if (!notificationId) {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already fired or already cancelled.
  }
}

/** Reads the deep link target out of a notification response. */
export function readReminderData(
  response: Notifications.NotificationResponse | null
): ReminderNotificationData | null {
  const data = response?.notification.request.content.data as
    | Partial<ReminderNotificationData>
    | undefined;

  if (!data || typeof data.savedItemId !== 'string') {
    return null;
  }

  return {
    savedItemId: data.savedItemId,
    reminderId: typeof data.reminderId === 'string' ? data.reminderId : '',
  };
}
