/**
 * Reminder preset maths. Pure module: no React, no Expo.
 *
 * Every function takes `now` explicitly so the results are deterministic in tests and so the
 * caller controls the clock. All arithmetic uses the device's local timezone, which is what a
 * user means by "tomorrow evening".
 */

export type ReminderPreset = 'later-today' | 'tomorrow' | 'this-weekend' | 'next-week' | 'custom';

export type ReminderPresetOption = {
  preset: Exclude<ReminderPreset, 'custom'>;
  label: string;
};

export type TimeOfDay = { hour: number; minute: number };

/** Used when the user has not set a Default Reminder Time. Matches `DEFAULT_SETTINGS`. */
export const DEFAULT_REMINDER_TIME: TimeOfDay = { hour: 9, minute: 0 };

/** Evening slot used by the "later today" preset. */
const EVENING_HOUR = 19;
/** Fallback offset when the evening slot has already passed today. */
const LATER_TODAY_FALLBACK_HOURS = 3;

const SATURDAY = 6;
const MONDAY = 1;

export const REMINDER_PRESETS: ReminderPresetOption[] = [
  { preset: 'later-today', label: 'Later today' },
  { preset: 'tomorrow', label: 'Tomorrow' },
  { preset: 'this-weekend', label: 'This weekend' },
  { preset: 'next-week', label: 'Next week' },
];

function atTime(base: Date, hour: number, minute = 0): Date {
  const result = new Date(base);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function addDays(base: Date, days: number): Date {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
}

/** Days from `from` forward to the next occurrence of `weekday`, never 0. */
function daysUntilNext(from: Date, weekday: number): number {
  const delta = (weekday - from.getDay() + 7) % 7;
  return delta === 0 ? 7 : delta;
}

/**
 * Resolves a preset to a concrete time.
 *
 * "Later today" always means this evening. The other presets land on `time`, the user's
 * Default Reminder Time. The result is always in the future relative to `now`.
 */
export function resolveReminderPreset(
  preset: Exclude<ReminderPreset, 'custom'>,
  now: Date = new Date(),
  time: TimeOfDay = DEFAULT_REMINDER_TIME
): Date {
  switch (preset) {
    case 'later-today': {
      const evening = atTime(now, EVENING_HOUR);
      if (evening.getTime() > now.getTime()) {
        return evening;
      }
      // The evening slot has passed, so fall back to a few hours from now.
      return new Date(now.getTime() + LATER_TODAY_FALLBACK_HOURS * 60 * 60 * 1000);
    }

    case 'tomorrow':
      return atTime(addDays(now, 1), time.hour, time.minute);

    case 'this-weekend':
      // The coming Saturday. On a Saturday or Sunday this rolls to the next weekend,
      // so the reminder is never "today".
      return atTime(addDays(now, daysUntilNext(now, SATURDAY)), time.hour, time.minute);

    case 'next-week':
      return atTime(addDays(now, daysUntilNext(now, MONDAY)), time.hour, time.minute);
  }
}

/** True when a chosen time has already passed and cannot be scheduled. */
export function isInPast(date: Date, now: Date = new Date()): boolean {
  return date.getTime() <= now.getTime();
}

/**
 * A sensible default for the custom picker, matching the "tomorrow" preset.
 */
export function defaultCustomReminderDate(
  now: Date = new Date(),
  time: TimeOfDay = DEFAULT_REMINDER_TIME
): Date {
  return resolveReminderPreset('tomorrow', now, time);
}
