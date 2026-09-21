import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { getPermissionState, type PermissionState, requestPermission } from '@/services/notifications';

/**
 * Notification permission state for the settings screen.
 *
 * The state is re-read when the app returns to the foreground, so granting permission in
 * system settings is reflected without a restart (PROJECT_PLAN.md §22).
 */
export function useNotificationPermission() {
  const [state, setState] = useState<PermissionState | null>(null);
  const [requesting, setRequesting] = useState(false);

  // The permission store is an external system, so it is read in an effect and never
  // written synchronously during render.
  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      let next: PermissionState;
      try {
        next = await getPermissionState();
      } catch {
        next = 'undetermined';
      }
      if (!cancelled) {
        setState(next);
      }
    };

    void read();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void read();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const request = useCallback(async () => {
    setRequesting(true);
    try {
      const next = await requestPermission();
      setState(next);

      // Once denied, only system settings can change it.
      if (next === 'denied') {
        await Linking.openSettings().catch(() => undefined);
      }
    } finally {
      setRequesting(false);
    }
  }, []);

  return { state, requesting, request };
}
