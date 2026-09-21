import { Image as ExpoImage } from 'expo-image';
import { withUniwind } from 'uniwind';

/**
 * Third-party components wrapped once so they accept `className`.
 *
 * Components from `react-native` and `react-native-reanimated` already support `className`
 * and must never be wrapped.
 */
export const Image = withUniwind(ExpoImage);
