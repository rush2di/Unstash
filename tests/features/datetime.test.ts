import { describe, expect, it } from 'vitest';

import {
  calendarDaysBetween,
  formatAge,
  formatRelative,
  formatReminderLabel,
  formatSavedDate,
  isOverdue,
} from '@/utils/datetime';

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

describe('calendarDaysBetween', () => {
  it('counts calendar days, not elapsed hours', () => {
    // 23:00 to 01:00 the next day is two hours but one calendar day.
    expect(calendarDaysBetween(local(2026, 9, 20, 23), local(2026, 9, 21, 1))).toBe(1);
    expect(calendarDaysBetween(local(2026, 9, 20, 1), local(2026, 9, 20, 23))).toBe(0);
    expect(calendarDaysBetween(local(2026, 9, 21), local(2026, 9, 20))).toBe(-1);
  });
});

describe('formatReminderLabel', () => {
  const now = local(2026, 9, 20, 12);

  it('labels today and tomorrow by name', () => {
    expect(formatReminderLabel(local(2026, 9, 20, 19).toISOString(), now)).toMatch(/^Today · /);
    expect(formatReminderLabel(local(2026, 9, 21, 19).toISOString(), now)).toMatch(/^Tomorrow · /);
    expect(formatReminderLabel(local(2026, 9, 19, 19).toISOString(), now)).toMatch(/^Yesterday · /);
  });

  it('uses the weekday inside the coming week', () => {
    const label = formatReminderLabel(local(2026, 9, 23, 10).toISOString(), now);
    expect(label).toMatch(/^Wednesday · /);
  });

  it('uses an absolute date beyond a week', () => {
    const label = formatReminderLabel(local(2026, 11, 5, 10).toISOString(), now);
    expect(label).toContain('Nov');
    expect(label).toContain('5');
  });

  it('includes the year only when it differs', () => {
    expect(formatReminderLabel(local(2027, 3, 1, 10).toISOString(), now)).toContain('2027');
    expect(formatReminderLabel(local(2026, 11, 5, 10).toISOString(), now)).not.toContain('2026');
  });

  it('handles an invalid date without throwing', () => {
    expect(formatReminderLabel('not-a-date', now)).toBe('Invalid date');
  });
});

describe('formatSavedDate', () => {
  const now = local(2026, 9, 20, 12);

  it('uses relative wording for recent saves', () => {
    expect(formatSavedDate(local(2026, 9, 20, 8).toISOString(), now)).toBe('Saved today');
    expect(formatSavedDate(local(2026, 9, 19, 8).toISOString(), now)).toBe('Saved yesterday');
  });

  it('uses a full date otherwise', () => {
    expect(formatSavedDate(local(2026, 9, 1, 8).toISOString(), now)).toContain('September');
  });

  it('handles an invalid date without throwing', () => {
    expect(formatSavedDate('nope', now)).toBe('Unknown date');
  });
});

describe('isOverdue', () => {
  const now = local(2026, 9, 20, 12);

  it('detects a past reminder', () => {
    expect(isOverdue(local(2026, 9, 20, 11).toISOString(), now)).toBe(true);
    expect(isOverdue(local(2026, 9, 20, 13).toISOString(), now)).toBe(false);
  });

  it('returns false for an invalid date', () => {
    expect(isOverdue('nope', now)).toBe(false);
  });
});


describe('formatRelative', () => {
  const now = local(2026, 9, 21, 12);

  it('labels the near future in minutes, hours and days', () => {
    expect(formatRelative(local(2026, 9, 21, 12, 30).toISOString(), now)).toBe('In 30m');
    expect(formatRelative(local(2026, 9, 21, 13).toISOString(), now)).toBe('In 1h');
    expect(formatRelative(local(2026, 9, 22, 5).toISOString(), now)).toBe('In 17h');
    expect(formatRelative(local(2026, 9, 24, 12).toISOString(), now)).toBe('In 3d');
  });

  it('labels the past with "ago"', () => {
    expect(formatRelative(local(2026, 9, 21, 10).toISOString(), now)).toBe('2h ago');
  });

  it('says Now within a minute', () => {
    expect(formatRelative(now.toISOString(), now)).toBe('Now');
  });

  it('returns empty for an invalid date', () => {
    expect(formatRelative('nope', now)).toBe('');
  });
});

describe('formatAge', () => {
  const now = local(2026, 9, 21, 12);

  it('uses compact units', () => {
    expect(formatAge(local(2026, 9, 21, 11, 55).toISOString(), now)).toBe('5m');
    expect(formatAge(local(2026, 9, 21, 9).toISOString(), now)).toBe('3h');
    expect(formatAge(local(2026, 9, 18, 12).toISOString(), now)).toBe('3d');
  });

  it('switches to a date after a week', () => {
    expect(formatAge(local(2026, 9, 1, 12).toISOString(), now)).toMatch(/Sep/);
  });
});
