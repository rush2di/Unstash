import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { GroupLabel, IconTile } from '@/components/grouped-list';
import { LargeTitle } from '@/components/large-title';
import { PreviewImage } from '@/components/preview-image';
import { Segmented } from '@/components/segmented';
import { AppText } from '@/components/text';
import { REPEAT_OPTIONS } from '@/features/reminders/repeat';
import { displayCaption } from '@/features/tags/hashtags';
import { useNow } from '@/hooks/use-now';
import { useLibraryStore } from '@/stores/library';
import type { ReminderRepeat, ReminderWithItem } from '@/types/domain';
import { cn } from '@/utils/cn';
import { formatRelative } from '@/utils/datetime';

type Entry = { kind: 'label'; title: string } | { kind: 'reminder'; entry: ReminderWithItem };

export default function RemindersScreen() {
  const reminders = useLibraryStore((state) => state.reminders);
  const now = useNow();

  // Overdue first: those are the ones the user already missed. Repeating reminders roll
  // forward on refresh, so only one-off reminders can be overdue.
  const rows = useMemo<Entry[]>(() => {
    const overdue = reminders.filter((entry) => new Date(entry.reminder.scheduledAt).getTime() <= now);
    const upcoming = reminders.filter((entry) => new Date(entry.reminder.scheduledAt).getTime() > now);

    return [
      ...(overdue.length > 0 ? [{ kind: 'label' as const, title: 'Overdue' }] : []),
      ...overdue.map((entry) => ({ kind: 'reminder' as const, entry })),
      ...(upcoming.length > 0 ? [{ kind: 'label' as const, title: 'Upcoming' }] : []),
      ...upcoming.map((entry) => ({ kind: 'reminder' as const, entry })),
    ];
  }, [now, reminders]);

  return (
    <View className="flex-1 bg-canvas">
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === 'label' ? `label-${row.title}` : row.entry.reminder.id)}
        renderItem={({ item }) =>
          item.kind === 'label' ? (
            <GroupLabel title={item.title} className="pt-3" />
          ) : (
            <ReminderCard entry={item.entry} now={now} />
          )
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <LargeTitle title="Reminders" subtitle={reminders.length > 0 ? `${reminders.length} active` : undefined} />
        }
        ListEmptyComponent={
          <EmptyState
            title="No reminders"
            description="Set a reminder when you save a post, or from any saved item."
          />
        }
        contentContainerClassName="pt-safe pb-28"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}

function ReminderCard({ entry, now }: { entry: ReminderWithItem; now: number }) {
  const router = useRouter();
  const setReminderRepeat = useLibraryStore((state) => state.setReminderRepeat);
  const setReminderNote = useLibraryStore((state) => state.setReminderNote);
  const removeReminder = useLibraryStore((state) => state.removeReminder);

  const { reminder, item } = entry;
  const [note, setNote] = useState(reminder.note ?? '');

  const handle = item.authorUsername ? `@${item.authorUsername}` : 'Instagram';
  const caption = displayCaption(item.caption);
  const overdue = reminder.repeat === 'once' && new Date(reminder.scheduledAt).getTime() <= now;
  const nowDate = new Date(now);

  const confirmRemove = () => {
    Alert.alert('Remove this reminder?', 'The saved item stays in Saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeReminder(reminder.id, item.id) },
    ]);
  };

  return (
    <View className="mx-5 rounded-2xl bg-surface overflow-hidden">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${handle}, ${formatRelative(reminder.scheduledAt, nowDate)}`}
        onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
        className="flex-row items-center gap-3 p-4 active:bg-surface-sunken">
        <PreviewImage item={item} className="w-16 h-16 rounded-xl" />
        <View className="flex-1 gap-0.5">
          <AppText variant="bodyStrong" numberOfLines={1}>
            {handle}
          </AppText>
          {caption ? (
            <AppText variant="caption" numberOfLines={2}>
              {caption}
            </AppText>
          ) : null}
          <AppText variant="captionStrong" className={cn(overdue ? 'text-danger' : 'text-warning')}>
            ⏰ {overdue ? `Overdue · ${formatRelative(reminder.scheduledAt, nowDate)}` : formatRelative(reminder.scheduledAt, nowDate)}
          </AppText>
        </View>
        <AppText variant="body" className="text-ink-faint">
          ›
        </AppText>
      </Pressable>

      <View className="ml-16 h-px bg-border" />
      <View className="flex-row items-center gap-3 px-4 py-2.5">
        <IconTile icon="🕐" tone="blue" />
        <AppText variant="body" className="flex-1">
          Repeat
        </AppText>
        <Segmented<ReminderRepeat>
          options={REPEAT_OPTIONS}
          value={reminder.repeat}
          onChange={(repeat) => void setReminderRepeat(reminder.id, repeat)}
          className="w-52"
        />
      </View>

      <View className="ml-16 h-px bg-border" />
      <View className="flex-row items-center gap-3 px-4 py-2.5">
        <IconTile icon="✏️" tone="amber" />
        <TextInput
          value={note}
          onChangeText={setNote}
          onEndEditing={() => {
            if (note.trim() !== (reminder.note ?? '')) {
              void setReminderNote(reminder.id, note);
            }
          }}
          placeholder="Add a note"
          placeholderTextColorClassName="accent-ink-faint"
          selectionColorClassName="accent-accent"
          accessibilityLabel="Reminder note"
          returnKeyType="done"
          className="flex-1 min-h-9 text-ink text-[16px]"
        />
      </View>

      <View className="ml-16 h-px bg-border" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove reminder"
        onPress={confirmRemove}
        className="flex-row items-center gap-3 px-4 py-2.5 active:bg-surface-sunken">
        <IconTile icon="🗑️" tone="red" />
        <AppText variant="body" className="text-danger">
          Remove Reminder
        </AppText>
      </Pressable>
    </View>
  );
}
