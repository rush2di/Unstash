import { Pressable, View } from 'react-native';

import { AppText } from './text';

export type ScreenHeaderProps = {
  title: string;
  /** Left action, usually Back or Cancel. */
  leftLabel?: string;
  onLeftPress?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
  rightDisabled?: boolean;
};

export function ScreenHeader({
  title,
  leftLabel,
  onLeftPress,
  rightLabel,
  onRightPress,
  rightDisabled = false,
}: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-5 h-12">
      <View className="flex-1 items-start">
        {leftLabel && onLeftPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={leftLabel}
            onPress={onLeftPress}
            hitSlop={12}
            className="active:opacity-60">
            <AppText variant="body" className="text-accent">
              {leftLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <AppText variant="bodyStrong" numberOfLines={1} className="flex-[2] text-center">
        {title}
      </AppText>

      <View className="flex-1 items-end">
        {rightLabel && onRightPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rightLabel}
            accessibilityState={{ disabled: rightDisabled }}
            disabled={rightDisabled}
            onPress={onRightPress}
            hitSlop={12}
            className="active:opacity-60">
            <AppText
              variant="bodyStrong"
              className={rightDisabled ? 'text-ink-faint' : 'text-accent'}>
              {rightLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
