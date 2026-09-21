import { View } from 'react-native';

import { AppText } from './text';

export function SectionHeader({ title, className }: { title: string; className?: string }) {
  return (
    <View className={className}>
      <AppText variant="label">{title}</AppText>
    </View>
  );
}
