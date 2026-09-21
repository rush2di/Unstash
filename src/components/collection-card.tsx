import { Pressable, View } from 'react-native';

import { PreviewImage } from './preview-image';
import { AppText } from './text';

import type { CollectionColor, SavedItem } from '@/types/domain';
import { cn } from '@/utils/cn';

/** Static class per colour key: Tailwind scans for literal class names at build time. */
export const COLLECTION_ACCENT: Record<CollectionColor, string> = {
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  slate: 'bg-slate-400',
};

export type CollectionTileProps = {
  name: string;
  emoji?: string;
  color?: CollectionColor;
  itemCount: number;
  /** Most recent item, whose preview becomes the cover. */
  cover?: SavedItem;
  onPress: () => void;
  onLongPress?: () => void;
};

export function CollectionTile({ name, emoji, color, itemCount, cover, onPress, onLongPress }: CollectionTileProps) {
  const label = `${itemCount} ${itemCount === 1 ? 'post' : 'posts'}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${label}`}
      accessibilityHint="Long press for options"
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-1 rounded-3xl bg-surface border border-border overflow-hidden active:opacity-85">
      {cover ? (
        <PreviewImage item={cover} className="w-full aspect-square" />
      ) : (
        <View className="w-full aspect-square bg-surface-sunken items-center justify-center">
          <AppText variant="display">{emoji ?? '📁'}</AppText>
        </View>
      )}
      <View className={cn('h-1', color ? COLLECTION_ACCENT[color] : 'bg-border')} />
      <View className="px-3.5 pt-2.5 pb-3.5 gap-0.5">
        <AppText variant="bodyStrong" numberOfLines={1}>
          {emoji ? `${emoji} ` : ''}
          {name}
        </AppText>
        <AppText variant="caption">{label}</AppText>
      </View>
    </Pressable>
  );
}
