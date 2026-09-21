import { Directory, File, Paths } from 'expo-file-system';

/**
 * On-disk thumbnail cache.
 *
 * Instagram's CDN URLs are signed and expire, so the remote URL is never treated as
 * permanent (PROJECT_PLAN.md §11). Once a thumbnail is downloaded the local file is what
 * the UI renders.
 *
 * Files live in the cache directory: the system may reclaim them, and the app re-downloads
 * on demand rather than treating that as data loss.
 */

const CACHE_FOLDER = 'thumbnails';

function cacheDirectory(): Directory {
  const directory = new Directory(Paths.cache, CACHE_FOLDER);
  if (!directory.exists) {
    directory.create({ intermediates: true });
  }
  return directory;
}

/** Stable, filesystem-safe name derived from the item id. */
function fileNameFor(savedItemId: string, remoteUrl: string): string {
  const extensionMatch = remoteUrl.split('?')[0].match(/\.(jpg|jpeg|png|webp|heic)$/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpg';
  const safeId = savedItemId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${safeId}.${extension}`;
}

/** Local file URI for an item's thumbnail, or null when nothing is cached. */
export function getCachedThumbnail(savedItemId: string, remoteUrl: string): string | null {
  try {
    const file = new File(cacheDirectory(), fileNameFor(savedItemId, remoteUrl));
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/**
 * Downloads a thumbnail and returns its local URI.
 *
 * An already-cached file is returned without downloading again. Returns null on failure so
 * the caller can fall back to the remote URL or to the unavailable state.
 */
export async function cacheThumbnail(
  savedItemId: string,
  remoteUrl: string
): Promise<string | null> {
  try {
    const directory = cacheDirectory();
    const fileName = fileNameFor(savedItemId, remoteUrl);

    const existing = new File(directory, fileName);
    if (existing.exists) {
      return existing.uri;
    }

    const downloaded = await File.downloadFileAsync(remoteUrl, new File(directory, fileName));
    return downloaded.exists ? downloaded.uri : null;
  } catch {
    return null;
  }
}

/** Removes an item's cached thumbnail. Safe to call when nothing is cached. */
export function deleteCachedThumbnail(cachedPath: string | undefined): void {
  if (!cachedPath) {
    return;
  }
  try {
    const file = new File(cachedPath);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // A cache file that cannot be deleted is not worth failing a user action over.
  }
}

/**
 * Deletes cached files that no longer belong to a saved item.
 *
 * Called after deletions so the cache does not grow forever (PROJECT_PLAN.md §11).
 */
export function pruneOrphanedThumbnails(liveItemIds: string[]): number {
  try {
    const directory = cacheDirectory();
    const live = new Set(liveItemIds);
    let removed = 0;

    for (const entry of directory.list()) {
      if (!(entry instanceof File)) {
        continue;
      }
      const id = entry.name.replace(/\.[^.]+$/, '');
      if (!live.has(id)) {
        entry.delete();
        removed += 1;
      }
    }

    return removed;
  } catch {
    return 0;
  }
}
