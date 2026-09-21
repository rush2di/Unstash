import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { AppText } from './text';

import {
  defaultCustomReminderDate,
  isInPast,
  REMINDER_PRESETS,
  type ReminderPreset,
  resolveReminderPreset,
} from '@/features/reminders/presets';
import { useLibraryStore } from '@/stores/library';
import { cn } from '@/utils/cn';
import { formatReminderLabel } from '@/utils/datetime';

type Selection = { preset: ReminderPreset; date: Date } | null;

export type ReminderPickerProps = {
  value: Date | null;
  onChange: (date: Date | null) => void;
  /** Injected for deterministic rendering in tests. */
  now?: Date;
};

function Chip({
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

/**
 * Reminder presets plus a custom date and time.
 *
 * Selecting the active chip again clears the reminder, so an item can be saved without one.
 */
export function ReminderPicker({ value, onChange, now = new Date() }: ReminderPickerProps) {
  const [selection, setSelection] = useState<Selection>(null);
  // Presets land on the user's Default Reminder Time from Profile.
  const hour = useLibraryStore((state) => state.settings.defaultReminderHour);
  const minute = useLibraryStore((state) => state.settings.defaultReminderMinute);
  const time = { hour, minute };
  const isCustom = selection?.preset === 'custom';

  const choosePreset = (preset: Exclude<ReminderPreset, 'custom'>) => {
    if (selection?.preset === preset) {
      setSelection(null);
      onChange(null);
      return;
    }
    const date = resolveReminderPreset(preset, now, time);
    setSelection({ preset, date });
    onChange(date);
  };

  const chooseCustom = () => {
    if (isCustom) {
      setSelection(null);
      onChange(null);
      return;
    }
    const date = value ?? defaultCustomReminderDate(now, time);
    setSelection({ preset: 'custom', date });
    onChange(date);
  };

  const onCustomDate = (date: Date) => {
    setSelection({ preset: 'custom', date });
    onChange(date);
  };

  return (
    <View className="gap-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-5">
        {REMINDER_PRESETS.map((option) => (
          <Chip
            key={option.preset}
            label={option.label}
            selected={selection?.preset === option.preset}
            onPress={() => choosePreset(option.preset)}
          />
        ))}
        <Chip label="Pick a time" selected={isCustom} onPress={chooseCustom} />
      </ScrollView>

      {isCustom && value ? (
        <View className="px-5">
          <DateTimePicker
            value={value}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            minimumDate={now}
            onValueChange={(_event, date) => onCustomDate(date)}
          />
        </View>
      ) : null}

      <View className="px-5">
        {value ? (
          <AppText variant="caption" className={isInPast(value, now) ? 'text-danger' : 'text-ink-soft'}>
            {isInPast(value, now)
              ? 'That time has already passed. Pick a later one.'
              : `We will remind you ${formatReminderLabel(value.toISOString(), now)}`}
          </AppText>
        ) : (
          <AppText variant="caption" className="text-ink-faint">
            No reminder. You can add one later.
          </AppText>
        )}
      </View>
    </View>
  );
}
