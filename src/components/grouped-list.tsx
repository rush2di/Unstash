import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './text';

import { cn } from '@/utils/cn';

/** Uppercase caption above a group, e.g. "PREFERENCES". */
export function GroupLabel({ title, className }: { title: string; className?: string }) {
  return (
    <AppText variant="label" className={cn('px-9 pb-2 text-ink-soft tracking-wider', className)}>
      {title}
    </AppText>
  );
}

/**
 * White rounded group with hairline separators between rows, the iOS inset-grouped pattern.
 * Separators are inset past the icon tile, as in the system Settings app.
 */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View className={cn('mx-5 rounded-2xl bg-surface overflow-hidden', className)}>
      {rows.map((row, index) => (
        <Fragment key={row.key ?? index}>
          {index > 0 ? <View className="ml-16 h-px bg-border" /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** Soft square behind a row's emoji icon. */
export function IconTile({ icon, tone = 'neutral' }: { icon: string; tone?: IconTone }) {
  return (
    <View className={cn('w-9 h-9 rounded-lg items-center justify-center', TONE[tone])}>
      <AppText variant="body">{icon}</AppText>
    </View>
  );
}

export type IconTone = 'neutral' | 'blue' | 'amber' | 'violet' | 'green' | 'red';

const TONE: Record<IconTone, string> = {
  neutral: 'bg-surface-sunken',
  blue: 'bg-accent-soft',
  amber: 'bg-amber-100',
  violet: 'bg-violet-100',
  green: 'bg-emerald-100',
  red: 'bg-red-100',
};

export type RowProps = {
  icon?: string;
  tone?: IconTone;
  title: string;
  /** Muted text on the right, e.g. "1 saved" or "9:00 AM". */
  value?: string;
  /** Replaces the value and chevron, e.g. a Switch. */
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** Hide the chevron on a pressable row. */
  hideChevron?: boolean;
  accessibilityLabel?: string;
};

export function Row({
  icon,
  tone,
  title,
  value,
  trailing,
  onPress,
  destructive = false,
  hideChevron = false,
  accessibilityLabel,
}: RowProps) {
  const content = (
    <View className="flex-row items-center gap-3 px-4 min-h-14 py-2.5">
      {icon ? <IconTile icon={icon} tone={tone ?? (destructive ? 'red' : 'neutral')} /> : null}
      <AppText
        variant="body"
        numberOfLines={1}
        className={cn('flex-1', destructive ? 'text-danger' : 'text-ink')}>
        {title}
      </AppText>
      {trailing ?? (
        <View className="flex-row items-center gap-2">
          {value ? (
            <AppText variant="body" className="text-ink-soft">
              {value}
            </AppText>
          ) : null}
          {onPress && !hideChevron && !destructive ? (
            <AppText variant="body" className="text-ink-faint">
              ›
            </AppText>
          ) : null}
        </View>
      )}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}
      onPress={onPress}
      className="active:bg-surface-sunken">
      {content}
    </Pressable>
  );
}
