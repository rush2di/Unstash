import { Pressable } from 'react-native';

import { AppText } from './text';

export function TagChip({ tag, onPress }: { tag: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`Tag ${tag}`}
      disabled={!onPress}
      onPress={onPress}
      className="px-2.5 py-1 rounded-lg bg-accent-soft active:opacity-70">
      <AppText variant="captionStrong" className="text-accent">
        #{tag}
      </AppText>
    </Pressable>
  );
}
