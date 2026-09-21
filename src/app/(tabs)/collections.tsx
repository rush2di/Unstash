import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, View } from 'react-native';

import { CollectionTile } from '@/components/collection-card';
import { EmptyState } from '@/components/empty-state';
import { LargeTitle } from '@/components/large-title';
import { AppText } from '@/components/text';
import { useLibraryStore } from '@/stores/library';
import type { CollectionWithCount, SavedItem } from '@/types/domain';

export default function CollectionsScreen() {
  const router = useRouter();

  const collections = useLibraryStore((state) => state.collections);
  const items = useLibraryStore((state) => state.items);
  const removeCollection = useLibraryStore((state) => state.removeCollection);

  /** Items are newest first, so the first match per collection is its most recent save. */
  const covers = useMemo(() => {
    const map = new Map<string, SavedItem>();
    for (const item of items) {
      if (item.collectionId && !map.has(item.collectionId)) {
        map.set(item.collectionId, item);
      }
    }
    return map;
  }, [items]);

  const confirmDelete = useCallback(
    (collection: CollectionWithCount) => {
      Alert.alert(`Delete "${collection.name}"?`, 'The saved items stay in Saved.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void removeCollection(collection.id) },
      ]);
    },
    [removeCollection]
  );

  const showOptions = useCallback(
    (collection: CollectionWithCount) => {
      const edit = () => router.push({ pathname: '/collection-form', params: { id: collection.id } });

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { title: collection.name, options: ['Edit', 'Delete', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
          (index) => {
            if (index === 0) {
              edit();
            } else if (index === 1) {
              confirmDelete(collection);
            }
          }
        );
        return;
      }

      Alert.alert(collection.name, undefined, [
        { text: 'Edit', onPress: edit },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(collection) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [confirmDelete, router]
  );

  return (
    <View className="flex-1 bg-canvas">
      <FlatList
        data={collections}
        keyExtractor={(collection) => collection.id}
        numColumns={2}
        columnWrapperClassName="gap-3 px-5"
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item, index }) => (
          <>
            <CollectionTile
              name={item.name}
              emoji={item.emoji}
              color={item.color}
              itemCount={item.itemCount}
              cover={covers.get(item.id)}
              onPress={() => router.push({ pathname: '/collection/[id]', params: { id: item.id } })}
              onLongPress={() => showOptions(item)}
            />
            {/* Keep a lone last tile half-width instead of stretching it. */}
            {index === collections.length - 1 && collections.length % 2 === 1 ? <View className="flex-1" /> : null}
          </>
        )}
        ListHeaderComponent={
          <View className="pb-1">
            <LargeTitle
              title="Collections"
              actionLabel="New"
              onAction={() => router.push('/collection-form')}
              actionAccessibilityLabel="New collection"
            />
            {collections.length > 0 ? (
              <AppText variant="label" className="px-6 pb-3 text-ink-soft tracking-wider">
                {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
              </AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No collections yet"
            description="Collections are optional. Group saved posts by theme when it helps."
            actionLabel="New collection"
            onAction={() => router.push('/collection-form')}
          />
        }
        contentContainerClassName="pt-safe pb-28"
      />
    </View>
  );
}
