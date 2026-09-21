/**
 * Typed user preferences over the string key-value `settings` table. Pure module.
 */

export type Settings = {
  /** Show hashtag chips and the Top interests list. */
  autoOrganizeTags: boolean;
  /** Play a sound with reminder notifications. */
  notificationSound: boolean;
  /** Light haptic feedback on key actions. */
  haptics: boolean;
  /** Time of day the reminder presets use, in local time. */
  defaultReminderHour: number;
  defaultReminderMinute: number;
};

export const DEFAULT_SETTINGS: Settings = {
  autoOrganizeTags: true,
  notificationSound: true,
  haptics: false,
  defaultReminderHour: 9,
  defaultReminderMinute: 0,
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return fallback;
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

/** Reads stored strings into settings, falling back per key on anything malformed. */
export function parseSettings(raw: Record<string, string>): Settings {
  return {
    autoOrganizeTags: parseBoolean(raw.autoOrganizeTags, DEFAULT_SETTINGS.autoOrganizeTags),
    notificationSound: parseBoolean(raw.notificationSound, DEFAULT_SETTINGS.notificationSound),
    haptics: parseBoolean(raw.haptics, DEFAULT_SETTINGS.haptics),
    defaultReminderHour: parseInteger(raw.defaultReminderHour, DEFAULT_SETTINGS.defaultReminderHour, 0, 23),
    defaultReminderMinute: parseInteger(
      raw.defaultReminderMinute,
      DEFAULT_SETTINGS.defaultReminderMinute,
      0,
      59
    ),
  };
}

export function serializeSetting<K extends keyof Settings>(value: Settings[K]): string {
  return String(value);
}
