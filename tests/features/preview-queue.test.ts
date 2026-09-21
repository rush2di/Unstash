import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestDatabase } from '../helpers/node-sqlite';

import type { SqlDatabase } from '@/db/adapter';
import { createSavedItem, getSavedItem, listItemsNeedingPreview } from '@/db/repositories';
import { processPendingPreviews, resolveItemPreview } from '@/features/instagram/preview-queue';
import type { SavedItem } from '@/types/domain';

// The queue reaches the network through this module, so it is the only thing mocked.
vi.mock('@/services/instagram/preview-client', () => ({
  fetchPreview: vi.fn(),
  isPreviewServiceConfigured: vi.fn(() => true),
}));

const client = await import('@/services/instagram/preview-client');
const fetchPreview = vi.mocked(client.fetchPreview);
const isPreviewServiceConfigured = vi.mocked(client.isPreviewServiceConfigured);

let db: SqlDatabase & { close: () => void };

const URL_A = 'https://www.instagram.com/p/AAA111/';
const URL_B = 'https://www.instagram.com/reel/BBB222/';

beforeEach(async () => {
  db = await createTestDatabase();
  fetchPreview.mockReset();
  isPreviewServiceConfigured.mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('resolveItemPreview', () => {
  it('stores resolved metadata and marks the preview available', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    fetchPreview.mockResolvedValue({
      normalizedUrl: URL_A,
      shortcode: 'AAA111',
      mediaType: 'image',
      authorUsername: 'janedoe',
      caption: 'a caption',
      thumbnailUrl: 'https://cdn.example/a.jpg',
    });

    const resolved = await resolveItemPreview(db, item);

    expect(resolved).toBe(true);
    const updated = await getSavedItem(db, item.id);
    expect(updated?.previewStatus).toBe('available');
    expect(updated?.authorUsername).toBe('janedoe');
    expect(updated?.caption).toBe('a caption');
    expect(updated?.mediaType).toBe('image');
    expect(updated?.thumbnailUrl).toBe('https://cdn.example/a.jpg');
  });

  it('marks the preview failed when the service returns nothing', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    fetchPreview.mockResolvedValue(null);

    const resolved = await resolveItemPreview(db, item);

    expect(resolved).toBe(false);
    expect((await getSavedItem(db, item.id))?.previewStatus).toBe('failed');
  });

  it('keeps the item usable when the preview fails', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    fetchPreview.mockResolvedValue(null);

    await resolveItemPreview(db, item);

    const updated = await getSavedItem(db, item.id);
    expect(updated?.instagramUrl).toBe(URL_A);
    expect(updated?.status).toBe('active');
  });

  it('handles a preview with no thumbnail', async () => {
    const item = await createSavedItem(db, { instagramUrl: URL_A });
    fetchPreview.mockResolvedValue({
      normalizedUrl: URL_A,
      shortcode: 'AAA111',
      mediaType: 'image',
    });

    expect(await resolveItemPreview(db, item)).toBe(true);
    expect((await getSavedItem(db, item.id))?.previewStatus).toBe('available');
  });
});

describe('processPendingPreviews', () => {
  it('processes every pending item', async () => {
    await createSavedItem(db, { instagramUrl: URL_A, savedAt: '2026-09-01T00:00:00.000Z' });
    await createSavedItem(db, { instagramUrl: URL_B, savedAt: '2026-09-02T00:00:00.000Z' });

    fetchPreview.mockImplementation(async (url: string) => ({
      normalizedUrl: url,
      shortcode: 'X',
      mediaType: 'image' as const,
      thumbnailUrl: 'https://cdn.example/a.jpg',
    }));

    const result = await processPendingPreviews(db);

    expect(result).toEqual({ processed: 2, resolved: 2, failed: 0, skipped: false });
    expect(await listItemsNeedingPreview(db)).toHaveLength(0);
  });

  it('counts failures separately', async () => {
    await createSavedItem(db, { instagramUrl: URL_A });
    await createSavedItem(db, { instagramUrl: URL_B });

    fetchPreview.mockImplementation(async (url: string) =>
      url === URL_A
        ? { normalizedUrl: url, shortcode: 'A', mediaType: 'image' as const }
        : null
    );

    const result = await processPendingPreviews(db);

    expect(result.resolved).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('leaves items pending when the service is not configured', async () => {
    await createSavedItem(db, { instagramUrl: URL_A });
    isPreviewServiceConfigured.mockReturnValue(false);

    const result = await processPendingPreviews(db);

    expect(result.skipped).toBe(true);
    expect(fetchPreview).not.toHaveBeenCalled();
    // Still pending, so it resolves once a service URL exists.
    expect(await listItemsNeedingPreview(db)).toHaveLength(1);
  });

  it('does nothing when there is nothing pending', async () => {
    const result = await processPendingPreviews(db);
    expect(result).toEqual({ processed: 0, resolved: 0, failed: 0, skipped: false });
  });

  it('never re-processes an item that already resolved', async () => {
    const item: SavedItem = await createSavedItem(db, { instagramUrl: URL_A });
    fetchPreview.mockResolvedValue({
      normalizedUrl: URL_A,
      shortcode: 'A',
      mediaType: 'image',
    });

    await processPendingPreviews(db);
    fetchPreview.mockClear();
    await processPendingPreviews(db);

    expect(fetchPreview).not.toHaveBeenCalled();
    expect((await getSavedItem(db, item.id))?.previewStatus).toBe('available');
  });
});
