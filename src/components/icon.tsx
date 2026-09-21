import { type AndroidSymbol, type SFSymbol, SymbolView } from 'expo-symbols';
import { useCSSVariable } from 'uniwind';

export type IconName = { ios: SFSymbol; android: AndroidSymbol };

export type IconProps = {
  name: IconName;
  size?: number;
  /** Theme token without the `--color-` prefix. */
  color?: 'accent' | 'ink' | 'ink-soft' | 'ink-faint' | 'danger' | 'warning' | 'on-accent';
};

/** Platform icon: SF Symbols on iOS, Material Symbols on Android, tinted from the theme. */
export function Icon({ name, size = 22, color = 'accent' }: IconProps) {
  const tint = useCSSVariable(`--color-${color}`);

  return (
    <SymbolView
      name={{ ios: name.ios, android: name.android, web: name.android }}
      size={size}
      tintColor={typeof tint === 'string' ? tint : undefined}
    />
  );
}
