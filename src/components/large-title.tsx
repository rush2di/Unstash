import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './text';

export type LargeTitleProps = {
  title: string;
  /** Small line under the title, e.g. "2 active". */
  subtitle?: string;
  /** Text action on the right, e.g. "New". */
  actionLabel?: string;
  /** Icon action on the right, e.g. a view toggle. */
  actionIcon?: ReactNode;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
};

/** iOS-style large title that scrolls with its screen. */
export function LargeTitle({
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
  actionAccessibilityLabel,
}: LargeTitleProps) {
  const hasAction = Boolean(onAction && (actionLabel || actionIcon));

  return (
    <View className="px-5 pt-2 pb-3">
      <View className="flex-row items-center justify-between">
        <AppText variant="display">{title}</AppText>
        {hasAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionAccessibilityLabel ?? actionLabel ?? title}
            onPress={onAction}
            hitSlop={12}
            className="active:opacity-60">
            {actionLabel ? (
              <AppText variant="heading" className="text-accent">
                {actionLabel}
              </AppText>
            ) : (
              actionIcon
            )}
          </Pressable>
        ) : null}
      </View>
      {subtitle ? (
        <AppText variant="body" className="text-ink-soft pt-0.5">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
