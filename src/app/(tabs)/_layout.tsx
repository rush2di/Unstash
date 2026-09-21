import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useLibraryStore } from '@/stores/library';

/**
 * `sf` supplies the iOS icon and `md` the Android one, so each platform uses its own
 * icon set without shipping bitmap assets.
 *
 * No appearance overrides: custom label styles push iOS 26 onto a custom tab bar
 * appearance, which truncated the labels once there were four tabs.
 */
export default function TabsLayout() {
  const activeReminders = useLibraryStore((state) => state.reminders.length);

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bookmark.fill" md="bookmark" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="collections">
        <NativeTabs.Trigger.Label>Collections</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="grid_view" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reminders">
        <NativeTabs.Trigger.Label>Reminders</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bell.fill" md="notifications" />
        <NativeTabs.Trigger.Badge hidden={activeReminders === 0}>{String(activeReminders)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
