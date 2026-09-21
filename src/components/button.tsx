import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { AppText } from './text';

import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-accent active:opacity-80',
  secondary: 'bg-surface-raised border border-border active:opacity-70',
  ghost: 'bg-transparent active:opacity-60',
  danger: 'bg-transparent border border-border active:opacity-70',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-on-accent',
  secondary: 'text-ink',
  ghost: 'text-accent',
  danger: 'text-danger',
};

const SIZE: Record<ButtonSize, string> = {
  md: 'h-11 px-4 rounded-xl',
  lg: 'h-14 px-5 rounded-2xl',
};

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Rendered before the label, e.g. an icon. */
  leading?: React.ReactNode;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  leading,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled === true || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        'flex-row items-center justify-center gap-2',
        CONTAINER[variant],
        SIZE[size],
        isDisabled && 'opacity-40',
        className
      )}
      {...rest}>
      {loading ? (
        <ActivityIndicator
          colorClassName={variant === 'primary' ? 'accent-on-accent' : 'accent-ink'}
        />
      ) : (
        <>
          {leading ? <View>{leading}</View> : null}
          <AppText variant="bodyStrong" className={LABEL[variant]}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}
