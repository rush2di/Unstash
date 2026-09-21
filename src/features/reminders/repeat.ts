/**
 * Repeating reminder maths. Pure module: no React, no Expo.
 *
 * A repeating reminder keeps one row whose `scheduledAt` is always the next occurrence.
 * When that time passes, the row rolls forward rather than completing.
 */

import type { ReminderRepeat } from '@/types/domain';

const DAY_MS = 24 * 60 * 60 * 1000;

function stepDays(repeat: ReminderRepeat): number {
  return repeat === 'weekly' ? 7 : 1;
}

/**
 * The first occurrence strictly after `now`.
 *
 * A one-off reminder returns its own time, even when that time has passed: a missed
 * one-off reminder is overdue, not rescheduled.
 */
export function nextOccurrence(scheduledAt: Date, repeat: ReminderRepeat, now: Date = new Date()): Date {
  if (repeat === 'once' || scheduledAt.getTime() > now.getTime()) {
    return scheduledAt;
  }

  const step = stepDays(repeat);
  const next = new Date(scheduledAt);
  // Advance by whole calendar days so the local time of day survives DST changes.
  const missedDays = Math.floor((now.getTime() - scheduledAt.getTime()) / DAY_MS);
  const jumps = Math.floor(missedDays / step);
  next.setDate(next.getDate() + jumps * step);

  while (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + step);
  }
  return next;
}

/** True for reminders that never become overdue. */
export function isRepeating(repeat: ReminderRepeat): boolean {
  return repeat !== 'once';
}

export const REPEAT_OPTIONS: { value: ReminderRepeat; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];
