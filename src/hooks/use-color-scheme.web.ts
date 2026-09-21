import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/** The server render never subscribes, so this store never changes. */
const subscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 *
 * `useSyncExternalStore` reports `false` during the server render and `true` on the client,
 * which gives the hydration guard without a state update inside an effect.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}
