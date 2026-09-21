import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Group, GroupLabel, Row } from '@/components/grouped-list';
import { ScreenHeader } from '@/components/screen-header';
import { AppText } from '@/components/text';

/** Plain statement of what the app stores and sends. Mirrors PROJECT_PLAN.md §24. */
export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-canvas pt-safe">
      <ScreenHeader title="Privacy & Security" leftLabel="Back" onLeftPress={() => router.back()} />
      <ScrollView contentContainerClassName="pt-2 pb-safe-offset-10 gap-6">
        <View>
          <GroupLabel title="Stored on this device" />
          <Group>
            <Row icon="🔗" title="Instagram links you save" />
            <Row icon="🖼️" title="Preview images and captions" />
            <Row icon="⏰" title="Reminders, notes and collections" />
          </Group>
        </View>

        <View>
          <GroupLabel title="Never collected" />
          <Group>
            <Row icon="🔑" tone="red" title="Your Instagram password" />
            <Row icon="🍪" tone="red" title="Instagram cookies or sessions" />
            <Row icon="👤" tone="red" title="Your Instagram account data" />
          </Group>
        </View>

        <View className="px-9 gap-3">
          <AppText variant="caption">
            When you save a link, only that public link is sent to the preview service, which reads the
            post&apos;s public metadata. The app only ever sees content you explicitly share to it.
          </AppText>
          <AppText variant="caption">
            Deleting an item removes it, its reminders and its cached image from this device.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}
