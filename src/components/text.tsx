import { Text as RNText, type TextProps } from 'react-native';

import { cn } from '@/utils/cn';

export type AppTextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'captionStrong'
  | 'label';

const VARIANT_CLASSES: Record<AppTextVariant, string> = {
  display: 'text-[34px] leading-[40px] font-bold tracking-tight text-ink',
  title: 'text-[26px] leading-[32px] font-bold tracking-tight text-ink',
  heading: 'text-[19px] leading-[25px] font-semibold text-ink',
  body: 'text-[16px] leading-[23px] text-ink',
  bodyStrong: 'text-[16px] leading-[23px] font-semibold text-ink',
  caption: 'text-[13px] leading-[18px] text-ink-soft',
  captionStrong: 'text-[13px] leading-[18px] font-semibold text-ink-soft',
  label: 'text-[11px] leading-[14px] font-semibold uppercase tracking-widest text-ink-faint',
};

export type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  className?: string;
};

export function AppText({ variant = 'body', className, ...rest }: AppTextProps) {
  return <RNText className={cn(VARIANT_CLASSES[variant], className)} {...rest} />;
}
