import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, Share, Switch, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Group, GroupLabel, Row } from '@/components/grouped-list';
import { LargeTitle } from '@/components/large-title';
import { AppText } from '@/components/text';
import { useNotificationPermission } from '@/features/reminders/use-notification-permission';
import { buildExport } from '@/features/settings/export';
import { topHashtags } from '@/features/tags/hashtags';
import { useLibraryStore } from '@/stores/library';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/datetime';

function StatTile({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-surface border border-border items-center py-4 gap-1">
      <AppText variant="title" className={className}>
        {value}
      </AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

function MixBar({ label, count, total, barClassName }: { label: string; count: number; total: number; barClassName: string }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);

  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between">
        <AppText variant="caption">{label}</AppText>
        <AppText variant="captionStrong" className="text-ink">
          {count}
        </AppText>
      </View>
      <View className="h-2 rounded-full bg-surface-sunken overflow-hidden">
        {/* A dynamic width has to be a style value; class names cannot be built at runtime. */}
        <View className={cn('h-2 rounded-full', barClassName)} style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();

  const items = useLibraryStore((state) => state.items);
  const collections = useLibraryStore((state) => state.collections);
  const reminders = useLibraryStore((state) => state.reminders);
  const settings = useLibraryStore((state) => state.settings);
  const updateSetting = useLibraryStore((state) => state.updateSetting);

  const permission = useNotificationPermission();
  const [editingTime, setEditingTime] = useState(false);

  const reels = items.filter((item) => item.mediaType === 'video').length;
  const posts = items.length - reels;
  const interests = useMemo(() => (settings.autoOrganizeTags ? topHashtags(items, 5) : []), [items, settings.autoOrganizeTags]);

  const reminderTime = new Date(2000, 0, 1, settings.defaultReminderHour, settings.defaultReminderMinute);
  const appName = Constants.expoConfig?.name ?? 'RemindMe';
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const onTimeChange = (date: Date) => {
    void updateSetting('defaultReminderHour', date.getHours());
    void updateSetting('defaultReminderMinute', date.getMinutes());
    if (Platform.OS !== 'ios') {
      setEditingTime(false);
    }
  };

  const exportData = async () => {
    const json = buildExport({ items, collections, reminders });
    await Share.share({ title: `${appName} export`, message: json }).catch(() => undefined);
  };

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pt-safe pb-28 gap-6">
        <LargeTitle title="Profile" />

        <View className="mx-5 -mt-3 rounded-2xl bg-surface p-4 flex-row items-center gap-4">
          <Avatar handle={appName} size="lg" />
          <View className="flex-1 gap-0.5">
            <AppText variant="heading">Your library</AppText>
            <AppText variant="caption">Personal curation space</AppText>
          </View>
        </View>

        <View>
          <GroupLabel title="Activity" />
          <View className="mx-5 flex-row gap-2.5">
            <StatTile value={items.length} label="Saved" className="text-accent" />
            <StatTile value={reels} label="Reels" className="text-violet-500" />
            <StatTile value={collections.length} label="Collections" className="text-emerald-500" />
            <StatTile value={reminders.length} label="Reminders" className="text-warning" />
          </View>

          {items.length > 0 ? (
            <View className="mx-5 mt-2.5 rounded-2xl bg-surface p-4 gap-3">
              <AppText variant="bodyStrong">Content mix</AppText>
              <MixBar label="Reels" count={reels} total={items.length} barClassName="bg-violet-500" />
              <MixBar label="Posts" count={posts} total={items.length} barClassName="bg-accent" />
            </View>
          ) : null}
        </View>

        {interests.length > 0 ? (
          <View>
            <GroupLabel title="Top interests" />
            <Group>
              {interests.map(({ tag, count }) => (
                <Row
                  key={tag}
                  icon="🏷️"
                  tone="amber"
                  title={`#${tag}`}
                  value={`${count} saved`}
                  onPress={() => router.push({ pathname: '/tag/[tag]', params: { tag } })}
                />
              ))}
            </Group>
          </View>
        ) : null}

        <View>
          <GroupLabel title="Preferences" />
          <Group>
            <Row
              icon="🏷️"
              tone="amber"
              title="Auto-organize tags"
              trailing={
                <Switch
                  accessibilityLabel="Auto-organize tags"
                  value={settings.autoOrganizeTags}
                  onValueChange={(value) => void updateSetting('autoOrganizeTags', value)}
                />
              }
            />
            <Row
              icon="🔔"
              tone="violet"
              title="Notification Sound"
              trailing={
                <Switch
                  accessibilityLabel="Notification sound"
                  value={settings.notificationSound}
                  onValueChange={(value) => void updateSetting('notificationSound', value)}
                />
              }
            />
            <Row
              icon="📳"
              tone="green"
              title="Haptics"
              trailing={
                <Switch
                  accessibilityLabel="Haptics"
                  value={settings.haptics}
                  onValueChange={(value) => void updateSetting('haptics', value)}
                />
              }
            />
          </Group>
        </View>

        <View>
          <Group>
            <Row
              icon="🔕"
              tone="red"
              title="Notifications"
              value={permission.state === 'granted' ? 'On' : 'Off'}
              onPress={permission.state === 'granted' ? undefined : () => void permission.request()}
            />
            {Platform.OS === 'ios' ? (
              <Row
                icon="⏰"
                tone="red"
                title="Default Reminder Time"
                trailing={
                  <DateTimePicker
                    value={reminderTime}
                    mode="time"
                    display="compact"
                    onValueChange={(_event, date) => onTimeChange(date)}
                  />
                }
              />
            ) : (
              <Row
                icon="⏰"
                tone="red"
                title="Default Reminder Time"
                value={formatTime(reminderTime)}
                onPress={() => setEditingTime(true)}
              />
            )}
            <Row icon="🔒" title="Privacy & Security" onPress={() => router.push('/privacy')} />
            <Row icon="📤" tone="blue" title="Export Data" onPress={() => void exportData()} />
          </Group>

          {permission.state === 'denied' ? (
            <AppText variant="caption" className="px-9 pt-2">
              Reminders are saved but will not alert you until notifications are on in system settings.
            </AppText>
          ) : null}
        </View>

        {editingTime && Platform.OS !== 'ios' ? (
          <DateTimePicker
            value={reminderTime}
            mode="time"
            onValueChange={(_event, date) => onTimeChange(date)}
            onDismiss={() => setEditingTime(false)}
          />
        ) : null}

        <AppText variant="caption" className="text-center text-ink-faint">
          {appName} · Version {version}
        </AppText>
      </ScrollView>
    </View>
  );
}
