import { describe, expect, it } from 'vitest';

import {
  defaultCustomReminderDate,
  isInPast,
  resolveReminderPreset,
} from '@/features/reminders/presets';

/** Local-time construction, so assertions hold in any timezone. */
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

describe('resolveReminderPreset', () => {
  describe('later today', () => {
    it('uses this evening when it has not passed', () => {
      const now = local(2026, 9, 20, 9);
      const result = resolveReminderPreset('later-today', now);
      expect(result.getDate()).toBe(20);
      expect(result.getHours()).toBe(19);
      expect(result.getMinutes()).toBe(0);
    });

    it('falls back to a few hours ahead when the evening has passed', () => {
      const now = local(2026, 9, 20, 21, 30);
      const result = resolveReminderPreset('later-today', now);
      expect(result.getTime()).toBe(now.getTime() + 3 * 60 * 60 * 1000);
    });

    it('is always in the future', () => {
      for (const hour of [0, 6, 12, 18, 19, 20, 23]) {
        const now = local(2026, 9, 20, hour, 5);
        expect(isInPast(resolveReminderPreset('later-today', now), now)).toBe(false);
      }
    });
  });

  describe('tomorrow', () => {
    it('is the next day at the default reminder time', () => {
      const now = local(2026, 9, 20, 9);
      const result = resolveReminderPreset('tomorrow', now);
      expect(result.getDate()).toBe(21);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
    });

    it('uses the configured reminder time', () => {
      const now = local(2026, 9, 20, 9);
      const result = resolveReminderPreset('tomorrow', now, { hour: 19, minute: 30 });
      expect(result.getHours()).toBe(19);
      expect(result.getMinutes()).toBe(30);
    });

    it('rolls over a month boundary', () => {
      const now = local(2026, 9, 30, 23, 30);
      const result = resolveReminderPreset('tomorrow', now);
      expect(result.getMonth()).toBe(9); // October, zero-based
      expect(result.getDate()).toBe(1);
    });
  });

  describe('this weekend', () => {
    it('is the coming Saturday at the default reminder time', () => {
      // 2026-09-20 is a Sunday; 2026-09-21 a Monday.
      const monday = local(2026, 9, 21, 9);
      expect(monday.getDay()).toBe(1);

      const result = resolveReminderPreset('this-weekend', monday);
      expect(result.getDay()).toBe(6);
      expect(result.getDate()).toBe(26);
      expect(result.getHours()).toBe(9);
    });

    it('rolls to next weekend when today is already Saturday', () => {
      const saturday = local(2026, 9, 26, 9);
      expect(saturday.getDay()).toBe(6);

      const result = resolveReminderPreset('this-weekend', saturday);
      expect(result.getDate()).toBe(3); // the following Saturday, in October
      expect(result.getDay()).toBe(6);
    });

    it('is always in the future', () => {
      for (let day = 20; day <= 26; day += 1) {
        const now = local(2026, 9, day, 12);
        expect(isInPast(resolveReminderPreset('this-weekend', now), now)).toBe(false);
      }
    });
  });

  describe('next week', () => {
    it('is the coming Monday at the default reminder time', () => {
      const wednesday = local(2026, 9, 23, 9);
      expect(wednesday.getDay()).toBe(3);

      const result = resolveReminderPreset('next-week', wednesday);
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(28);
      expect(result.getHours()).toBe(9);
    });

    it('rolls a full week forward when today is Monday', () => {
      const monday = local(2026, 9, 21, 9);
      const result = resolveReminderPreset('next-week', monday);
      expect(result.getDate()).toBe(28);
    });

    it('is always in the future', () => {
      for (let day = 20; day <= 26; day += 1) {
        const now = local(2026, 9, day, 12);
        expect(isInPast(resolveReminderPreset('next-week', now), now)).toBe(false);
      }
    });
  });
});

describe('isInPast', () => {
  it('treats the exact current instant as past, since it cannot be scheduled', () => {
    const now = local(2026, 9, 20, 12);
    expect(isInPast(new Date(now), now)).toBe(true);
    expect(isInPast(new Date(now.getTime() + 1000), now)).toBe(false);
    expect(isInPast(new Date(now.getTime() - 1000), now)).toBe(true);
  });
});

describe('defaultCustomReminderDate', () => {
  it('matches the tomorrow preset', () => {
    const now = local(2026, 9, 20, 9);
    expect(defaultCustomReminderDate(now).getTime()).toBe(
      resolveReminderPreset('tomorrow', now).getTime()
    );
  });
});
