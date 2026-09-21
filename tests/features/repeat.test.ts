import { describe, expect, it } from 'vitest';

import { isRepeating, nextOccurrence } from '@/features/reminders/repeat';

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

describe('nextOccurrence', () => {
  it('leaves a one-off reminder alone, even in the past', () => {
    const at = local(2026, 9, 18, 9);
    expect(nextOccurrence(at, 'once', local(2026, 9, 21, 12)).getTime()).toBe(at.getTime());
  });

  it('leaves a future repeating reminder alone', () => {
    const at = local(2026, 9, 22, 9);
    expect(nextOccurrence(at, 'daily', local(2026, 9, 21, 12)).getTime()).toBe(at.getTime());
  });

  it('rolls a daily reminder to the next day at the same time', () => {
    const next = nextOccurrence(local(2026, 9, 18, 9), 'daily', local(2026, 9, 21, 12));
    expect(next.getDate()).toBe(22);
    expect(next.getHours()).toBe(9);
  });

  it('rolls a daily reminder to later today when that time has not passed', () => {
    const next = nextOccurrence(local(2026, 9, 18, 18), 'daily', local(2026, 9, 21, 12));
    expect(next.getDate()).toBe(21);
    expect(next.getHours()).toBe(18);
  });

  it('keeps a weekly reminder on the same weekday', () => {
    const start = local(2026, 9, 1, 9); // a Tuesday
    const next = nextOccurrence(start, 'weekly', local(2026, 9, 21, 12));
    expect(next.getDay()).toBe(start.getDay());
    expect(next.getDate()).toBe(22);
    expect(next.getHours()).toBe(9);
  });

  it('treats the exact scheduled instant as passed', () => {
    const at = local(2026, 9, 21, 9);
    expect(nextOccurrence(at, 'daily', at).getDate()).toBe(22);
  });

  it('keeps the local time of day across a DST change', () => {
    // Crosses the late-October clock change in zones that observe it; a no-op elsewhere.
    const next = nextOccurrence(local(2026, 10, 20, 9), 'daily', local(2026, 11, 5, 12));
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });

  it('is always after now for repeats', () => {
    const now = local(2026, 9, 21, 12);
    for (const repeat of ['daily', 'weekly'] as const) {
      expect(nextOccurrence(local(2025, 1, 1, 7), repeat, now).getTime()).toBeGreaterThan(now.getTime());
    }
  });
});

describe('isRepeating', () => {
  it('is false only for once', () => {
    expect(isRepeating('once')).toBe(false);
    expect(isRepeating('daily')).toBe(true);
    expect(isRepeating('weekly')).toBe(true);
  });
});
