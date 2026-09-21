import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { SavedItemRow } from '@/components/saved-item-card';
import { ScreenHeader } from '@/components/screen-header';
import { extractHashtags } from '@/features/tags/hashtags';
import { useLibraryStore } from '@/stores/library';
import type { SavedItem } from '@/types/domain';
import { cn } from '@/utils/cn';

/** Every saved item whose caption carries one hashtag. */
export default function TagScreen() {
  const router = useRouter();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const items = useLibraryStore((state) => state.items);

  const needle = (tag ?? '').toLowerCase();
  const visible = useMemo(
    () => items.filter((item) => extractHashtags(item.caption).includes(needle)),
    [items, needle]
  );

  const openItem = useCallback(
    (item: SavedItem) => router.push({ pathname: '/item/[id]', params: { id: item.id } }),
    [router]
  );

  return (
    <View className="flex-1 bg-canvas pt-safe">
      <ScreenHeader title={`#${needle}`} leftLabel="Back" onLeftPress={() => router.back()} />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View
            className={cn(
              'mx-5 bg-surface overflow-hidden',
              index === 0 && 'rounded-t-2xl mt-2',
              index === visible.length - 1 && 'rounded-b-2xl'
            )}>
            {index > 0 ? <View className="ml-24 h-px bg-border" /> : null}
            <SavedItemRow item={item} onPress={openItem} />
          </View>
        )}
        ListEmptyComponent={<EmptyState title="No posts with this tag" description="Tags come from captions." />}
        contentContainerClassName="pb-safe-offset-10"
      />
    </View>
  );
}
