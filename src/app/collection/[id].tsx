import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { SavedItemRow } from '@/components/saved-item-card';
import { ScreenHeader } from '@/components/screen-header';
import { AppText } from '@/components/text';
import { useLibraryStore } from '@/stores/library';
import type { SavedItem } from '@/types/domain';
import { cn } from '@/utils/cn';

export default function CollectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const items = useLibraryStore((state) => state.items);
  const collection = useLibraryStore((state) => state.collections.find((entry) => entry.id === id));

  const visible = useMemo(() => items.filter((item) => item.collectionId === id), [id, items]);

  const openItem = useCallback(
    (item: SavedItem) => router.push({ pathname: '/item/[id]', params: { id: item.id } }),
    [router]
  );

  const title = collection ? `${collection.emoji ? `${collection.emoji} ` : ''}${collection.name}` : 'Collection';

  return (
    <View className="flex-1 bg-canvas pt-safe">
      <ScreenHeader
        title={title}
        leftLabel="Back"
        onLeftPress={() => router.back()}
        rightLabel={collection ? 'Edit' : undefined}
        onRightPress={
          collection ? () => router.push({ pathname: '/collection-form', params: { id: collection.id } }) : undefined
        }
      />

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View
            className={cn(
              'mx-5 bg-surface overflow-hidden',
              index === 0 && 'rounded-t-2xl',
              index === visible.length - 1 && 'rounded-b-2xl'
            )}>
            {index > 0 ? <View className="ml-24 h-px bg-border" /> : null}
            <SavedItemRow item={item} onPress={openItem} />
          </View>
        )}
        ListHeaderComponent={
          visible.length > 0 ? (
            <AppText variant="label" className="px-9 pt-2 pb-2 text-ink-soft tracking-wider">
              {visible.length} {visible.length === 1 ? 'post' : 'posts'}
            </AppText>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing here yet"
            description="Move a saved post into this collection from its detail screen."
          />
        }
        contentContainerClassName="pb-safe-offset-10"
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  );
}
