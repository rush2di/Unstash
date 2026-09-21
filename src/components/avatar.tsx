import { View } from 'react-native';

import { AppText } from './text';

import { cn } from '@/utils/cn';

/**
 * Initial-letter avatar.
 *
 * Neither preview source exposes the author's profile picture, so this shows the first
 * letter of the handle rather than a fake photo.
 */
export function Avatar({ handle, size = 'md' }: { handle?: string; size?: 'md' | 'lg' }) {
  const letter = (handle?.replace(/^@/, '')[0] ?? '?').toUpperCase();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(
        'rounded-full bg-accent-soft items-center justify-center',
        size === 'lg' ? 'w-16 h-16' : 'w-8 h-8'
      )}>
      <AppText variant={size === 'lg' ? 'title' : 'captionStrong'} className="text-accent">
        {letter}
      </AppText>
    </View>
  );
}
