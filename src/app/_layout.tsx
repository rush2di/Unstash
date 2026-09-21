import '@/global.css';

import { Stack } from 'expo-router';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaListener, SafeAreaProvider } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

import { useNotificationRouting } from '@/features/reminders/use-notification-routing';
import { useShareIntake } from '@/features/sharing/use-share-intake';
import { useLibraryStore } from '@/stores/library';

/** Everything that needs the router or the share context lives below the provider. */
function AppShell() {
  const init = useLibraryStore((state) => state.init);
  const resolvePreviews = useLibraryStore((state) => state.resolvePreviews);

  useShareIntake();
  useNotificationRouting();

  useEffect(() => {
    void init();
  }, [init]);

  // Catch up on previews that were pending when the app was last closed.
  useEffect(() => {
    void resolvePreviews();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void resolvePreviews();
      }
    });

    return () => subscription.remove();
  }, [resolvePreviews]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="save"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="item/[id]" />
      <Stack.Screen name="collection/[id]" />
      <Stack.Screen name="collection-form" options={{ presentation: 'modal' }} />
      <Stack.Screen name="tag/[tag]" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="reminder/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <SafeAreaProvider>
        {/* Uniwind's `*-safe` utilities read the insets published here. */}
        <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
          <AppShell />
        </SafeAreaListener>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}
