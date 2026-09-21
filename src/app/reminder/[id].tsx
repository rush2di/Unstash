import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';

import { Button } from '@/components/button';
import { PreviewImage } from '@/components/preview-image';
import { ReminderPicker } from '@/components/reminder-picker';
import { ScreenHeader } from '@/components/screen-header';
import { AppText } from '@/components/text';
import { getSavedItem } from '@/db/repositories';
import {
  completeDueReminders,
  rescheduleReminder,
} from '@/features/reminders/scheduler';
import { getDatabase, useLibraryStore } from '@/stores/library';
import type { SavedItem } from '@/types/domain';
import { formatReminderLabel } from '@/utils/datetime';

/**
 * Reminder completion, reached by tapping a notification.
 *
 * The app's own preview is shown first; opening Instagram is the user's choice
 * (PROJECT_PLAN.md §16 and §17). The route parameter is the saved item id.
 */
export default function ReminderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const refresh = useLibraryStore((state) => state.refresh);
  const notificationSound = useLibraryStore((state) => state.settings.notificationSound);

  const [item, setItem] = useState<SavedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);

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
  }, [id]);

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

  /** Marks every reminder that has come due as completed. The item itself stays active. */
  const markDone = useCallback(async () => {
    if (!item) {
      return;
    }
    const db = await getDatabase();
    await completeDueReminders(db, item.id);
    await refresh();
    router.back();
  }, [item, refresh, router]);

  const saveNewReminder = useCallback(async () => {
    if (!item || !draft) {
      return;
    }
    const db = await getDatabase();
    await rescheduleReminder(db, item.id, draft, { sound: notificationSound });
    await refresh();
    router.back();
  }, [draft, item, notificationSound, refresh, router]);

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
        <ScreenHeader title="Reminder" leftLabel="Close" onLeftPress={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <AppText variant="heading" className="text-center">
            This item is no longer saved
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas pt-safe">
      <ScreenHeader title="Reminder" leftLabel="Close" onLeftPress={() => router.back()} />

      <View className="flex-1 px-5 gap-6">
        <View className="items-center pt-2">
          <PreviewImage item={item} size="detail" className="w-2/3 aspect-post rounded-3xl" />
        </View>

        <View className="gap-1">
          <AppText variant="title">Did you revisit this?</AppText>
          <AppText variant="caption">
            {item.authorUsername ? `@${item.authorUsername}` : 'Instagram post'}
            {item.reminderAt ? ` · ${formatReminderLabel(item.reminderAt)}` : ''}
          </AppText>
        </View>

        {rescheduling ? (
          <View className="gap-3 -mx-5">
            <ReminderPicker value={draft} onChange={setDraft} />
            <View className="px-5 flex-row gap-2">
              <Button
                label="Set reminder"
                className="flex-1"
                disabled={!draft}
                onPress={saveNewReminder}
              />
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setRescheduling(false)}
              />
            </View>
          </View>
        ) : (
          <View className="gap-3">
            <Button label="Open in Instagram" size="lg" onPress={openInInstagram} />
            <Button label="Done" variant="secondary" onPress={markDone} />
            <Button
              label="Remind me again"
              variant="ghost"
              onPress={() => {
                setDraft(null);
                setRescheduling(true);
              }}
            />
            <Button
              label="See full details"
              variant="ghost"
              onPress={() => router.replace({ pathname: '/item/[id]', params: { id: item.id } })}
            />
          </View>
        )}
      </View>
    </View>
  );
}
