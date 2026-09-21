import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { LargeTitle } from '@/components/large-title';
import { SavedItemCard, SavedItemTile } from '@/components/saved-item-card';
import { Segmented } from '@/components/segmented';
import { AppText } from '@/components/text';
import { useSavedItemSearch } from '@/features/saved-items/use-search';
import { useNow } from '@/hooks/use-now';
import { useLibraryStore } from '@/stores/library';
import type { SavedItem } from '@/types/domain';

type MediaFilter = 'all' | 'reels' | 'posts';
type Layout = 'cards' | 'grid';

/** A reel resolves to `video`; everything else is shown under Posts. */
function matchesMedia(item: SavedItem, filter: MediaFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  const isReel = item.mediaType === 'video';
  return filter === 'reels' ? isReel : !isReel;
}

export default function SavedScreen() {
  const router = useRouter();

  const status = useLibraryStore((state) => state.status);
  const error = useLibraryStore((state) => state.error);
  const items = useLibraryStore((state) => state.items);
  const showTags = useLibraryStore((state) => state.settings.autoOrganizeTags);
  const refresh = useLibraryStore((state) => state.refresh);
  const init = useLibraryStore((state) => state.init);

  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [media, setMedia] = useState<MediaFilter>('all');
  const [layout, setLayout] = useState<Layout>('cards');
  const now = useNow();

  // The item count changes on every library mutation, which is enough to re-run a search.
  const search = useSavedItemSearch(query, 'all', items.length);

  const visible = useMemo(
    () => (search.active ? search.results : items).filter((item) => matchesMedia(item, media)),
    [items, media, search.active, search.results]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const openItem = useCallback(
    (item: SavedItem) => router.push({ pathname: '/item/[id]', params: { id: item.id } }),
    [router]
  );

  if (status === 'loading' || status === 'idle') {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator colorClassName="accent-ink-faint" />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-8 gap-3">
        <AppText variant="heading" className="text-center">
          We could not open your library
        </AppText>
        <AppText variant="caption" className="text-center">
          {error ?? 'Unknown error'}
        </AppText>
        <Button label="Try again" variant="secondary" onPress={() => void init()} />
      </View>
    );
  }

  const isGrid = layout === 'grid';

  const header = (
    <View className="pb-3">
      <LargeTitle
        title="Saved"
        actionIcon={
          <Icon
            name={
              isGrid
                ? { ios: 'rectangle.grid.1x2.fill', android: 'view_agenda' }
                : { ios: 'square.grid.2x2.fill', android: 'grid_view' }
            }
            size={24}
          />
        }
        actionAccessibilityLabel={isGrid ? 'Show as cards' : 'Show as grid'}
        onAction={items.length > 0 ? () => setLayout(isGrid ? 'cards' : 'grid') : undefined}
      />

      {items.length > 0 ? (
        <View className="px-5 gap-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColorClassName="accent-ink-faint"
            selectionColorClassName="accent-accent"
            accessibilityLabel="Search saved items"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            className="h-11 px-4 rounded-xl bg-surface-sunken text-ink"
          />
          <Segmented<MediaFilter>
            options={[
              { value: 'all', label: `All (${items.length})` },
              { value: 'reels', label: 'Reels' },
              { value: 'posts', label: 'Posts' },
            ]}
            value={media}
            onChange={setMedia}
          />
          {visible.length > 0 ? (
            <AppText variant="label" className="pt-3 pl-1 text-ink-soft tracking-wider">
              {visible.length} saved
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const empty =
    items.length === 0 ? (
      <EmptyState
        title="Nothing saved yet"
        description="Share a post or reel from Instagram to this app, and we will remind you to come back to it."
        actionLabel="Paste a link instead"
        onAction={() => router.push('/save')}
      />
    ) : search.searching ? (
      <View className="py-16 items-center">
        <ActivityIndicator colorClassName="accent-ink-faint" />
      </View>
    ) : (
      <EmptyState
        title="Nothing matches"
        description="Try a different word, or switch back to All."
        actionLabel="Clear search"
        onAction={() => {
          setQuery('');
          setMedia('all');
        }}
      />
    );

  return (
    <View className="flex-1 bg-canvas">
      <FlatList
        // Remount when switching layout: FlatList cannot change numColumns in place.
        key={layout}
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={isGrid ? 2 : 1}
        columnWrapperClassName={isGrid ? 'gap-3 px-5' : undefined}
        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item }) =>
          isGrid ? (
            <SavedItemTile item={item} onPress={openItem} />
          ) : (
            <SavedItemCard
              item={item}
              now={new Date(now)}
              onPress={openItem}
              showTags={showTags}
              onTagPress={(tag) => setQuery(`#${tag}`)}
            />
          )
        }
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerClassName="pt-safe pb-28"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  );
}
