import { describe, expect, it } from 'vitest';

import { buildExport } from '@/features/settings/export';
import { DEFAULT_SETTINGS, parseSettings } from '@/features/settings/settings';
import type { SavedItem } from '@/types/domain';

describe('parseSettings', () => {
  it('uses defaults when nothing is stored', () => {
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('reads stored values', () => {
    expect(
      parseSettings({ haptics: 'true', notificationSound: 'false', defaultReminderHour: '19', defaultReminderMinute: '30' })
    ).toMatchObject({ haptics: true, notificationSound: false, defaultReminderHour: 19, defaultReminderMinute: 30 });
  });

  it('falls back per key on malformed values', () => {
    const parsed = parseSettings({ haptics: 'yes', defaultReminderHour: '25', defaultReminderMinute: 'x' });
    expect(parsed.haptics).toBe(DEFAULT_SETTINGS.haptics);
    expect(parsed.defaultReminderHour).toBe(DEFAULT_SETTINGS.defaultReminderHour);
    expect(parsed.defaultReminderMinute).toBe(DEFAULT_SETTINGS.defaultReminderMinute);
  });
});

describe('buildExport', () => {
  const item: SavedItem = {
    id: 'i1',
    instagramUrl: 'https://www.instagram.com/p/A/',
    mediaType: 'image',
    savedAt: '2026-09-20T00:00:00.000Z',
    status: 'active',
    previewStatus: 'available',
    cachedThumbnailPath: 'file:///private/device/path.jpg',
  };

  it('drops device-local file paths but keeps the Instagram URL', () => {
    const json = JSON.parse(buildExport({ items: [item], collections: [], reminders: [] }));
    expect(json.items[0].instagramUrl).toBe(item.instagramUrl);
    expect(json.items[0]).not.toHaveProperty('cachedThumbnailPath');
  });

  it('carries a format marker and timestamp', () => {
    const json = JSON.parse(
      buildExport({ items: [], collections: [], reminders: [], exportedAt: new Date('2026-09-21T00:00:00.000Z') })
    );
    expect(json.format).toBe('remindme-export');
    expect(json.exportedAt).toBe('2026-09-21T00:00:00.000Z');
  });
});
