import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { readReminderData } from '@/services/notifications';

/**
 * Routes a notification tap to the reminder screen.
 *
 * The app shows its own preview first; opening Instagram stays the user's choice
 * (PROJECT_PLAN.md §16). `useLastNotificationResponse` also covers a cold start, where the
 * tap happened before the listener existed.
 */
export function useNotificationRouting(): void {
  const router = useRouter();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }

    // The same response object is replayed on every render, so each one is routed once.
    const responseId = lastResponse.notification.request.identifier;
    if (handled.current === responseId) {
      return;
    }

    const data = readReminderData(lastResponse);
    if (!data) {
      return;
    }

    handled.current = responseId;
    router.push({ pathname: '/reminder/[id]', params: { id: data.savedItemId } });
  }, [lastResponse, router]);
}
