/**
 * Date formatting helpers. Pure module: no React, no Expo.
 *
 * `Intl` is available in Hermes with the full ICU build that React Native ships,
 * so no date library is needed.
 */

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Whole calendar days from `now` to `date`. Negative when `date` is in the past. */
export function calendarDaysBetween(now: Date, date: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / msPerDay);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, TIME_FORMAT).format(date);
}

/**
 * Human label for a reminder time, in the plan's "Tomorrow · 7:00 PM" shape.
 *
 * Near dates use a relative word, dates inside a week use the weekday, and anything
 * further out uses an absolute date.
 */
export function formatReminderLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const days = calendarDaysBetween(now, date);
  const time = formatTime(date);

  if (days === 0) {
    return `Today · ${time}`;
  }
  if (days === 1) {
    return `Tomorrow · ${time}`;
  }
  if (days === -1) {
    return `Yesterday · ${time}`;
  }
  if (days > 1 && days < 7) {
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date);
    return `${weekday} · ${time}`;
  }

  const absolute = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date);

  return `${absolute} · ${time}`;
}

/** Short label for when an item was saved, e.g. "Saved September 20". */
export function formatSavedDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  const days = calendarDaysBetween(now, date);
  if (days === 0) {
    return 'Saved today';
  }
  if (days === -1) {
    return 'Saved yesterday';
  }

  const formatted = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date);

  return `Saved ${formatted}`;
}

/** True when the reminder time has passed. */
export function isOverdue(iso: string, now: Date = new Date()): boolean {
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
}

/**
 * Short relative label: "In 1h", "In 17h", "In 3d", "2h ago", "Now".
 * Used where space is tight, such as the Reminders tab rows.
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = date.getTime() - now.getTime();
  const past = diffMs < 0;
  const minutes = Math.round(Math.abs(diffMs) / 60_000);

  if (minutes < 1) {
    return 'Now';
  }

  let amount: string;
  if (minutes < 60) {
    amount = `${minutes}m`;
  } else if (minutes < 60 * 24) {
    amount = `${Math.round(minutes / 60)}h`;
  } else {
    amount = `${Math.round(minutes / (60 * 24))}d`;
  }

  return past ? `${amount} ago` : `In ${amount}`;
}

/** Compact age for a card footer: "now", "5m", "3h", "3d", "Sep 2". */
export function formatAge(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) {
    return 'now';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  if (minutes < 60 * 24) {
    return `${Math.floor(minutes / 60)}h`;
  }
  const days = Math.floor(minutes / (60 * 24));
  if (days < 7) {
    return `${days}d`;
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
