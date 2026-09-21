import type { CollectionWithCount, ReminderWithItem, SavedItem } from '@/types/domain';

/**
 * Serialises the library for the Export Data action. Pure function.
 *
 * Local file paths are dropped: they are meaningless on any other device. The Instagram
 * URL is kept, since it is the source of truth for every item.
 */
export function buildExport(input: {
  items: SavedItem[];
  collections: CollectionWithCount[];
  reminders: ReminderWithItem[];
  exportedAt?: Date;
}): string {
  const { items, collections, reminders, exportedAt = new Date() } = input;

  return JSON.stringify(
    {
      format: 'remindme-export',
      version: 1,
      exportedAt: exportedAt.toISOString(),
      collections: collections.map(({ id, name, emoji, color, createdAt }) => ({ id, name, emoji, color, createdAt })),
      items: items.map(({ cachedThumbnailPath: _local, ...item }) => item),
      reminders: reminders.map(({ reminder }) => ({
        id: reminder.id,
        savedItemId: reminder.savedItemId,
        scheduledAt: reminder.scheduledAt,
        repeat: reminder.repeat,
        note: reminder.note,
      })),
    },
    null,
    2
  );
}
