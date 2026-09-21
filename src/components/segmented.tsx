import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { View } from 'react-native';

export type SegmentedProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * Native segmented control (UISegmentedControl on iOS, Material on Android), keyed by value
 * rather than index so callers never juggle positions.
 */
export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  return (
    <View className={className}>
      <SegmentedControl
        values={options.map((option) => option.label)}
        selectedIndex={selectedIndex}
        onChange={(event) => {
          const next = options[event.nativeEvent.selectedSegmentIndex];
          if (next && next.value !== value) {
            onChange(next.value);
          }
        }}
        style={{ height: 34 }}
      />
    </View>
  );
}
