import type {
  Collection,
  CollectionColor,
  CollectionWithCount,
  MediaType,
  PreviewStatus,
  Reminder,
  ReminderRepeat,
  ReminderStatus,
  SavedItem,
  SavedItemStatus,
} from '@/types/domain';

export type SavedItemRow = {
  id: string;
  instagram_url: string;
  instagram_shortcode: string | null;
  media_type: string;
  author_username: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  cached_thumbnail_path: string | null;
  collection_id: string | null;
  saved_at: string;
  reminder_at: string | null;
  status: string;
  preview_status: string;
};

export type CollectionRow = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  created_at: string;
};

export type CollectionWithCountRow = CollectionRow & { item_count: number };

export type ReminderRow = {
  id: string;
  saved_item_id: string;
  scheduled_at: string;
  notification_id: string | null;
  completed_at: string | null;
  status: string;
  repeat: string;
  note: string | null;
};

const MEDIA_TYPES: MediaType[] = ['image', 'video', 'carousel', 'unknown'];
const ITEM_STATUSES: SavedItemStatus[] = ['active', 'completed', 'archived'];
const PREVIEW_STATUSES: PreviewStatus[] = ['pending', 'available', 'failed'];
const REMINDER_STATUSES: ReminderStatus[] = ['scheduled', 'completed', 'cancelled'];
const REMINDER_REPEATS: ReminderRepeat[] = ['once', 'daily', 'weekly'];
export const COLLECTION_COLORS: CollectionColor[] = ['violet', 'rose', 'sky', 'amber', 'emerald', 'slate'];

/** Falls back to a safe default rather than throwing, so one bad row cannot break a list. */
function toEnum<T extends string>(value: string, allowed: T[], fallback: T): T {
  return (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function optional(value: string | null): string | undefined {
  return value === null || value === '' ? undefined : value;
}

export function toSavedItem(row: SavedItemRow): SavedItem {
  return {
    id: row.id,
    instagramUrl: row.instagram_url,
    instagramShortcode: optional(row.instagram_shortcode),
    mediaType: toEnum(row.media_type, MEDIA_TYPES, 'unknown'),
    authorUsername: optional(row.author_username),
    caption: optional(row.caption),
    thumbnailUrl: optional(row.thumbnail_url),
    cachedThumbnailPath: optional(row.cached_thumbnail_path),
    collectionId: optional(row.collection_id),
    savedAt: row.saved_at,
    reminderAt: optional(row.reminder_at),
    status: toEnum(row.status, ITEM_STATUSES, 'active'),
    previewStatus: toEnum(row.preview_status, PREVIEW_STATUSES, 'pending'),
  };
}

export function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    emoji: optional(row.emoji),
    color: row.color && (COLLECTION_COLORS as string[]).includes(row.color)
      ? (row.color as CollectionColor)
      : undefined,
    createdAt: row.created_at,
  };
}

export function toCollectionWithCount(row: CollectionWithCountRow): CollectionWithCount {
  return {
    ...toCollection(row),
    itemCount: row.item_count,
  };
}

export function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    savedItemId: row.saved_item_id,
    scheduledAt: row.scheduled_at,
    notificationId: optional(row.notification_id),
    completedAt: optional(row.completed_at),
    status: toEnum(row.status, REMINDER_STATUSES, 'scheduled'),
    repeat: toEnum(row.repeat ?? 'once', REMINDER_REPEATS, 'once'),
    note: optional(row.note),
  };
}
