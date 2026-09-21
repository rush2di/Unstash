import { Pressable, View } from 'react-native';

import { Avatar } from './avatar';
import { PreviewImage } from './preview-image';
import { TagChip } from './tag-chip';
import { AppText } from './text';

import { displayCaption, extractHashtags } from '@/features/tags/hashtags';
import type { SavedItem } from '@/types/domain';
import { cn } from '@/utils/cn';
import { formatAge, formatRelative, isOverdue } from '@/utils/datetime';

const MAX_TAGS = 3;

function handleOf(item: SavedItem): string {
  return item.authorUsername ? `@${item.authorUsername}` : 'Instagram';
}

function hasImage(item: SavedItem): boolean {
  return Boolean(item.cachedThumbnailPath ?? item.thumbnailUrl);
}

export type SavedItemCardProps = {
  item: SavedItem;
  onPress: (item: SavedItem) => void;
  onTagPress?: (tag: string) => void;
  showTags?: boolean;
  now?: Date;
};

/**
 * Full-width card for the Saved list: cover with the caption over a scrim, then the author,
 * reminder and age, then hashtag chips.
 */
export function SavedItemCard({ item, onPress, onTagPress, showTags = true, now = new Date() }: SavedItemCardProps) {
  const caption = displayCaption(item.caption);
  const tags = showTags ? extractHashtags(item.caption).slice(0, MAX_TAGS) : [];
  const overdue = item.reminderAt ? isOverdue(item.reminderAt, now) : false;
  const imageShown = hasImage(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${handleOf(item)}${caption ? `, ${caption}` : ''}`}
      onPress={() => onPress(item)}
      className="mx-5 rounded-3xl bg-surface border border-border overflow-hidden active:opacity-90">
      <View>
        <PreviewImage item={item} size="detail" className="w-full aspect-card" />
        {imageShown && caption ? (
          // Scrim keeps white text legible on any photo.
          <View className="absolute left-0 right-0 bottom-0 px-4 pt-10 pb-3 bg-gradient-to-t from-black/75 to-transparent">
            <AppText variant="bodyStrong" numberOfLines={2} className="text-white">
              {caption}
            </AppText>
          </View>
        ) : null}
      </View>

      {!imageShown && caption ? (
        <AppText variant="body" numberOfLines={2} className="px-4 pt-3">
          {caption}
        </AppText>
      ) : null}

      <View className="flex-row items-center gap-3 px-4 pt-3 pb-3">
        <Avatar handle={item.authorUsername} />
        <AppText variant="bodyStrong" numberOfLines={1} className="flex-1">
          {handleOf(item)}
        </AppText>
        {item.reminderAt ? (
          <AppText variant="captionStrong" className={cn(overdue ? 'text-danger' : 'text-warning')}>
            ⏰ {formatRelative(item.reminderAt, now)}
          </AppText>
        ) : null}
        <AppText variant="caption">{formatAge(item.savedAt, now)}</AppText>
        <AppText variant="body" className="text-ink-faint">
          ›
        </AppText>
      </View>

      {tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 px-4 pb-4">
          {tags.map((tag) => (
            <TagChip key={tag} tag={tag} onPress={onTagPress ? () => onTagPress(tag) : undefined} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

/** Compact square tile for the grid view. */
export function SavedItemTile({ item, onPress }: { item: SavedItem; onPress: (item: SavedItem) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={handleOf(item)}
      onPress={() => onPress(item)}
      className="flex-1 active:opacity-80">
      <PreviewImage item={item} className="w-full aspect-square rounded-2xl" />
      <AppText variant="captionStrong" numberOfLines={1} className="pt-1.5 px-0.5 text-ink">
        {handleOf(item)}
      </AppText>
    </Pressable>
  );
}

/** Row used inside a collection. */
export function SavedItemRow({ item, onPress, now = new Date() }: SavedItemCardProps) {
  const caption = displayCaption(item.caption);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={handleOf(item)}
      onPress={() => onPress(item)}
      className="flex-row gap-3 px-4 py-3 active:bg-surface-sunken">
      <PreviewImage item={item} className="w-16 h-16 rounded-xl" />
      <View className="flex-1 justify-center gap-0.5">
        <AppText variant="bodyStrong" numberOfLines={1}>
          {handleOf(item)}
        </AppText>
        {caption ? (
          <AppText variant="caption" numberOfLines={2}>
            {caption}
          </AppText>
        ) : null}
        <AppText variant="caption" className="text-ink-faint">
          {formatAge(item.savedAt, now)}
        </AppText>
      </View>
    </Pressable>
  );
}
