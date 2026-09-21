import { View } from 'react-native';

import { Button } from './button';
import { AppText } from './text';

export type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="items-center justify-center px-8 py-16 gap-2">
      <AppText variant="heading" className="text-center">
        {title}
      </AppText>
      <AppText variant="body" className="text-center text-ink-soft">
        {description}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" className="mt-4" onPress={onAction} />
      ) : null}
    </View>
  );
}
