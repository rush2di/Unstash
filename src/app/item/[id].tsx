import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { PreviewImage } from '@/components/preview-image';
import { ReminderPicker } from '@/components/reminder-picker';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { AppText } from '@/components/text';
import { getSavedItem } from '@/db/repositories';
import { retryPreview } from '@/features/instagram/preview-queue';
import { cancelAllReminders, rescheduleReminder } from '@/features/reminders/scheduler';
import { isPreviewServiceConfigured } from '@/services/instagram/preview-client';
import { getDatabase, useLibraryStore } from '@/stores/library';
import type { SavedItem } from '@/types/domain';
import { cn } from '@/utils/cn';
import { formatReminderLabel, formatSavedDate, isOverdue } from '@/utils/datetime';

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const collections = useLibraryStore((state) => state.collections);
  const storeItems = useLibraryStore((state) => state.items);
  const refresh = useLibraryStore((state) => state.refresh);
  const updateItemStatus = useLibraryStore((state) => state.updateItemStatus);
  const moveItemToCollection = useLibraryStore((state) => state.moveItemToCollection);
  const notificationSound = useLibraryStore((state) => state.settings.notificationSound);

  const [item, setItem] = useState<SavedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState(false);
  const [draftReminder, setDraftReminder] = useState<Date | null>(null);
  const [movingCollection, setMovingCollection] = useState(false);
  const [retryingPreview, setRetryingPreview] = useState(false);

  // Read straight from the database: an archived item is no longer in the store cache.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const db = await getDatabase();
      const found = await getSavedItem(db, id);
      if (!cancelled) {
        setItem(found);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, storeItems]);

  const openInInstagram = useCallback(async () => {
    if (!item) {
      return;
    }
    try {
      await Linking.openURL(item.instagramUrl);
    } catch {
      Alert.alert(
        'Could not open Instagram',
        'The link may no longer work, or Instagram is not installed.'
      );
    }
  }, [item]);

  const saveReminder = useCallback(async () => {
    if (!item) {
      return;
    }
    const db = await getDatabase();
    if (draftReminder) {
      await rescheduleReminder(db, item.id, draftReminder, { sound: notificationSound });
    } else {
      await cancelAllReminders(db, item.id);
    }
    await refresh();
    setEditingReminder(false);
  }, [draftReminder, item, notificationSound, refresh]);

  const onRetryPreview = useCallback(async () => {
    if (!item) {
      return;
    }
    setRetryingPreview(true);
    try {
      const db = await getDatabase();
      const resolved = await retryPreview(db, item);
      if (resolved) {
        setItem(await getSavedItem(db, item.id));
        await refresh();
      }
    } finally {
      setRetryingPreview(false);
    }
  }, [item, refresh]);

  const archive = useCallback(() => {
    if (!item) {
      return;
    }
    Alert.alert('Archive this item?', 'It leaves your saved list. Reminders are cancelled.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const db = await getDatabase();
            await cancelAllReminders(db, item.id);
            await updateItemStatus(item.id, 'archived');
            router.back();
          })();
        },
      },
    ]);
  }, [item, router, updateItemStatus]);

  if (loading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator colorClassName="accent-ink-faint" />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 bg-canvas pt-safe">
        <ScreenHeader title="Saved item" leftLabel="Back" onLeftPress={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <AppText variant="heading" className="text-center">
            This item is gone
          </AppText>
        </View>
      </View>
    );
  }

  const overdue = item.reminderAt ? isOverdue(item.reminderAt) : false;
  const collectionName =
    collections.find((collection) => collection.id === item.collectionId)?.name ?? 'All saved';

  return (
    <View className="flex-1 bg-canvas pt-safe">
      <ScreenHeader title="Saved item" leftLabel="Back" onLeftPress={() => router.back()} />

      <ScrollView className="flex-1" contentContainerClassName="pb-safe-offset-10 gap-6">
        <View className="px-5 pt-2">
          <PreviewImage
            item={item}
            size="detail"
            className="w-full aspect-post rounded-3xl"
          />
        </View>

        <View className="px-5 gap-2">
          <AppText variant="title">
            {item.authorUsername ? `@${item.authorUsername}` : 'Instagram post'}
          </AppText>

          {item.caption ? <AppText variant="body">{item.caption}</AppText> : null}

          <AppText variant="caption">{formatSavedDate(item.savedAt)}</AppText>

          {item.previewStatus === 'failed' ? (
            <View className="gap-2 pt-1">
              <AppText variant="caption" className="text-ink-faint">
                Preview unavailable. The link still works.
              </AppText>
              {isPreviewServiceConfigured() ? (
                <Button
                  label="Try the preview again"
                  variant="secondary"
                  loading={retryingPreview}
                  onPress={onRetryPreview}
                />
              ) : null}
            </View>
          ) : null}
        </View>

        <View className="gap-2">
          <SectionHeader title="Reminder" className="px-5" />
          {editingReminder ? (
            <View className="gap-3">
              <ReminderPicker value={draftReminder} onChange={setDraftReminder} />
              <View className="px-5 flex-row gap-2">
                <Button label="Save reminder" className="flex-1" onPress={saveReminder} />
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setEditingReminder(false)}
                />
              </View>
            </View>
          ) : (
            <View className="px-5 gap-3">
              <AppText
                variant="bodyStrong"
                className={cn(overdue ? 'text-warning' : 'text-ink')}>
                {item.reminderAt
                  ? `${overdue ? 'Overdue · ' : ''}${formatReminderLabel(item.reminderAt)}`
                  : 'No reminder set'}
              </AppText>
              <Button
                label={item.reminderAt ? 'Change reminder' : 'Add a reminder'}
                variant="secondary"
                onPress={() => {
                  setDraftReminder(item.reminderAt ? new Date(item.reminderAt) : null);
                  setEditingReminder(true);
                }}
              />
            </View>
          )}
        </View>

        <View className="gap-2">
          <SectionHeader title="Collection" className="px-5" />
          <View className="px-5 gap-3">
            <AppText variant="bodyStrong">{collectionName}</AppText>
            <Button
              label="Move collection"
              variant="secondary"
              onPress={() => setMovingCollection((value) => !value)}
            />
          </View>

          {movingCollection ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 px-5">
              <MoveChip
                label="All saved"
                selected={!item.collectionId}
                onPress={() => {
                  void moveItemToCollection(item.id, null);
                  setMovingCollection(false);
                }}
              />
              {collections.map((collection) => (
                <MoveChip
                  key={collection.id}
                  label={collection.name}
                  selected={item.collectionId === collection.id}
                  onPress={() => {
                    void moveItemToCollection(item.id, collection.id);
                    setMovingCollection(false);
                  }}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View className="px-5 gap-3 pt-2">
          <Button label="Open in Instagram" size="lg" onPress={openInInstagram} />
          <Button label="Archive" variant="danger" onPress={archive} />
        </View>
      </ScrollView>
    </View>
  );
}

function MoveChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'h-10 px-4 rounded-full items-center justify-center border active:opacity-70',
        selected ? 'bg-accent border-accent' : 'bg-surface border-border'
      )}>
      <AppText variant="captionStrong" className={selected ? 'text-on-accent' : 'text-ink'}>
        {label}
      </AppText>
    </Pressable>
  );
}
