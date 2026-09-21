import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { COLLECTION_ACCENT } from '@/components/collection-card';
import { GroupLabel } from '@/components/grouped-list';
import { ScreenHeader } from '@/components/screen-header';
import { AppText } from '@/components/text';
import { COLLECTION_COLORS } from '@/db/mappers';
import { useLibraryStore } from '@/stores/library';
import type { CollectionColor } from '@/types/domain';
import { cn } from '@/utils/cn';

const EMOJI = ['🏡', '🍜', '✈️', '🎨', '💡', '📚', '👗', '💪', '🎵', '🛍️', '🌿', '📸'];

/** Create a collection, or edit one when an `id` is passed. Presented as a sheet. */
export default function CollectionFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const existing = useLibraryStore((state) => state.collections.find((collection) => collection.id === id));
  const addCollection = useLibraryStore((state) => state.addCollection);
  const updateCollection = useLibraryStore((state) => state.updateCollection);

  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState<string | undefined>(existing?.emoji ?? EMOJI[0]);
  const [color, setColor] = useState<CollectionColor>(existing?.color ?? 'violet');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    const draft = { name, emoji, color };
    if (existing) {
      await updateCollection(existing.id, draft);
    } else {
      await addCollection(draft);
    }
    router.back();
  };

  return (
    <View className="flex-1 bg-canvas pt-safe">
      <ScreenHeader
        title={existing ? 'Edit collection' : 'New collection'}
        leftLabel="Cancel"
        onLeftPress={() => router.back()}
        rightLabel="Save"
        onRightPress={() => void save()}
        rightDisabled={!canSave}
      />

      <ScrollView contentContainerClassName="pt-4 pb-10 gap-6" keyboardShouldPersistTaps="handled">
        <View className="items-center gap-3">
          <View className="w-24 h-24 rounded-3xl bg-surface items-center justify-center overflow-hidden">
            <AppText variant="display">{emoji ?? '📁'}</AppText>
            <View className={cn('absolute left-0 right-0 bottom-0 h-1.5', COLLECTION_ACCENT[color])} />
          </View>
        </View>

        <View>
          <GroupLabel title="Name" />
          <View className="mx-5 rounded-2xl bg-surface px-4">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Home Inspo"
              placeholderTextColorClassName="accent-ink-faint"
              selectionColorClassName="accent-accent"
              accessibilityLabel="Collection name"
              autoFocus={!existing}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              className="h-12 text-ink text-[16px]"
            />
          </View>
        </View>

        <View>
          <GroupLabel title="Icon" />
          <View className="mx-5 rounded-2xl bg-surface p-3 flex-row flex-wrap gap-2">
            {EMOJI.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Icon ${option}`}
                accessibilityState={{ selected: emoji === option }}
                onPress={() => setEmoji(option)}
                className={cn(
                  'w-12 h-12 rounded-xl items-center justify-center',
                  emoji === option ? 'bg-accent-soft' : 'bg-transparent'
                )}>
                <AppText variant="title">{option}</AppText>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <GroupLabel title="Colour" />
          <View className="mx-5 rounded-2xl bg-surface p-4 flex-row justify-between">
            {COLLECTION_COLORS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Colour ${option}`}
                accessibilityState={{ selected: color === option }}
                onPress={() => setColor(option)}
                hitSlop={6}
                className={cn(
                  'w-9 h-9 rounded-full items-center justify-center border-2',
                  color === option ? 'border-ink' : 'border-transparent'
                )}>
                <View className={cn('w-7 h-7 rounded-full', COLLECTION_ACCENT[option])} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
