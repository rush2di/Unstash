import type { SqlDatabase } from '@/db/adapter';
import { applyPreview, listItemsNeedingPreview } from '@/db/repositories';
import { fetchPreview, isPreviewServiceConfigured } from '@/services/instagram/preview-client';
import { cacheThumbnail } from '@/services/storage/thumbnail-cache';
import type { SavedItem } from '@/types/domain';

/**
 * Background preview resolution.
 *
 * Saving never waits on this queue (PROJECT_PLAN.md §10). It runs after a save and when the
 * app comes to the foreground, and it only ever moves an item from `pending` to `available`
 * or `failed`.
 */

/** Resolved in parallel, kept low so a batch does not saturate the network or the service. */
const CONCURRENCY = 2;
/** Items handled per run, so a large backlog is spread over several runs. */
const BATCH_SIZE = 12;

let running = false;

export type PreviewRunResult = {
  processed: number;
  resolved: number;
  failed: number;
  skipped: boolean;
};

/** Resolves one item and writes the outcome. Never throws. */
export async function resolveItemPreview(db: SqlDatabase, item: SavedItem): Promise<boolean> {
  const preview = await fetchPreview(item.instagramUrl);

  if (!preview) {
    await applyPreview(db, item.id, { previewStatus: 'failed' });
    return false;
  }

  // Cache the image before marking the preview available, so the UI never renders an
  // expiring remote URL when a local copy could exist.
  const cachedThumbnailPath = preview.thumbnailUrl
    ? ((await cacheThumbnail(item.id, preview.thumbnailUrl)) ?? undefined)
    : undefined;

  await applyPreview(db, item.id, {
    mediaType: preview.mediaType,
    authorUsername: preview.authorUsername,
    caption: preview.caption,
    thumbnailUrl: preview.thumbnailUrl,
    cachedThumbnailPath,
    previewStatus: 'available',
  });

  return true;
}

/** Runs `worker` over `items`, at most `limit` at a time. */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<boolean>
): Promise<boolean[]> {
  const results: boolean[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * Processes pending previews.
 *
 * Does nothing when the preview service is not configured: items stay `pending` so they
 * resolve once a service URL exists, rather than being written off as failures.
 */
export async function processPendingPreviews(db: SqlDatabase): Promise<PreviewRunResult> {
  if (!isPreviewServiceConfigured() || running) {
    return { processed: 0, resolved: 0, failed: 0, skipped: true };
  }

  running = true;
  try {
    const pending = await listItemsNeedingPreview(db, BATCH_SIZE);
    if (pending.length === 0) {
      return { processed: 0, resolved: 0, failed: 0, skipped: false };
    }

    const outcomes = await mapWithConcurrency(pending, CONCURRENCY, (item) =>
      resolveItemPreview(db, item)
    );

    const resolved = outcomes.filter(Boolean).length;
    return {
      processed: pending.length,
      resolved,
      failed: pending.length - resolved,
      skipped: false,
    };
  } finally {
    running = false;
  }
}

/** Puts one item back in the queue after a failure, for a user-triggered retry. */
export async function retryPreview(db: SqlDatabase, item: SavedItem): Promise<boolean> {
  if (!isPreviewServiceConfigured()) {
    return false;
  }
  return resolveItemPreview(db, item);
}
