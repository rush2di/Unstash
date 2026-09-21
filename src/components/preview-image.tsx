import { ActivityIndicator, View } from 'react-native';

import { Image } from './styled';
import { AppText } from './text';

import type { SavedItem } from '@/types/domain';
import { cn } from '@/utils/cn';

export type PreviewImageProps = {
  item: Pick<SavedItem, 'previewStatus' | 'cachedThumbnailPath' | 'thumbnailUrl' | 'mediaType'>;
  /** Shape of the frame. Cards use a square crop; detail views use the media's own ratio. */
  className?: string;
  /** Larger type and padding for the detail screen. */
  size?: 'card' | 'detail';
};

/**
 * The saved preview, which is the primary visual element of the product.
 *
 * A missing preview is a normal state, not an error: the item stays fully usable and the
 * frame explains itself (PROJECT_PLAN.md §10).
 */
export function PreviewImage({ item, className, size = 'card' }: PreviewImageProps) {
  // The cached file is preferred: remote Instagram URLs expire.
  const source = item.cachedThumbnailPath ?? item.thumbnailUrl ?? null;
  const isCompact = size === 'card';

  if (source) {
    return (
      <View className={cn('overflow-hidden bg-surface-sunken', className)}>
        <Image
          source={{ uri: source }}
          className="w-full h-full"
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          accessibilityLabel={
            item.mediaType === 'video' || item.mediaType === 'carousel'
              ? `Instagram ${item.mediaType} preview`
              : 'Instagram post preview'
          }
        />
      </View>
    );
  }

  if (item.previewStatus === 'pending') {
    return (
      <View
        accessibilityLabel="Loading preview"
        className={cn(
          'overflow-hidden bg-surface-sunken items-center justify-center',
          className
        )}>
        <ActivityIndicator colorClassName="accent-ink-faint" />
      </View>
    );
  }

  return (
    <View
      accessibilityLabel="Preview unavailable"
      className={cn(
        'overflow-hidden bg-surface-sunken border border-border items-center justify-center gap-1',
        isCompact ? 'px-2' : 'px-6',
        className
      )}>
      <AppText variant={isCompact ? 'label' : 'captionStrong'} className="text-ink-faint">
        Instagram
      </AppText>
      <AppText
        variant={isCompact ? 'caption' : 'body'}
        className="text-ink-faint text-center"
        numberOfLines={2}>
        Preview unavailable
      </AppText>
    </View>
  );
}
