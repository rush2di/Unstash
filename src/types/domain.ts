/**
 * Domain model for the app. These types mirror the SQLite schema in `src/db/schema.ts`.
 *
 * All timestamps are ISO 8601 strings in UTC. The Instagram URL is always the source of
 * truth for an item; every other Instagram-derived field is cached enrichment data.
 */

export type MediaType = 'image' | 'video' | 'carousel' | 'unknown';

export type SavedItemStatus = 'active' | 'completed' | 'archived';

export type PreviewStatus = 'pending' | 'available' | 'failed';

export type ReminderStatus = 'scheduled' | 'completed' | 'cancelled';

/** How often a reminder fires. A repeating reminder stays `scheduled` and rolls forward. */
export type ReminderRepeat = 'once' | 'daily' | 'weekly';

/** Accent colours a collection can carry. Keys map to static classes in the UI. */
export type CollectionColor = 'violet' | 'rose' | 'sky' | 'amber' | 'emerald' | 'slate';

export type SavedItem = {
  id: string;

  instagramUrl: string;
  instagramShortcode?: string;

  mediaType: MediaType;

  authorUsername?: string;
  caption?: string;

  thumbnailUrl?: string;
  cachedThumbnailPath?: string;

  collectionId?: string;

  savedAt: string;

  /** Time of the next scheduled reminder, kept in sync with the `reminders` table. */
  reminderAt?: string;

  status: SavedItemStatus;

  previewStatus: PreviewStatus;
};

export type Collection = {
  id: string;
  name: string;
  emoji?: string;
  color?: CollectionColor;
  createdAt: string;
};

export type Reminder = {
  id: string;

  savedItemId: string;

  scheduledAt: string;

  /** Identifier returned by `expo-notifications`, used to cancel the scheduled notification. */
  notificationId?: string;

  completedAt?: string;

  status: ReminderStatus;

  repeat: ReminderRepeat;

  /** Free-text note the user attaches, e.g. "Check dimensions before buying". */
  note?: string;
};

/** A reminder joined with the item it belongs to, for the Reminders tab. */
export type ReminderWithItem = {
  reminder: Reminder;
  item: SavedItem;
};

/** A collection plus its item count, used by the collections list. */
export type CollectionWithCount = Collection & {
  itemCount: number;
};
