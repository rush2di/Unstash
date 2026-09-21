import { useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect } from 'react';

import { extractInstagramUrl, parseInstagramUrl } from '@/services/instagram/parse-url';

/**
 * Turns an incoming share into a save draft.
 *
 * Share sheets deliver either a bare URL or caption text with the link inside it, so both
 * shapes are handled. An unusable share still opens the save screen, which explains why it
 * was rejected rather than failing silently.
 */
export function useShareIntake(): void {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) {
      return;
    }

    const raw = shareIntent.webUrl ?? shareIntent.text ?? '';
    const url = parseInstagramUrl(raw).isValid ? raw : extractInstagramUrl(raw);

    // Clear immediately so re-entering the app does not replay the same share.
    resetShareIntent();

    router.push({
      pathname: '/save',
      params: url ? { url } : { rejected: raw.slice(0, 300) },
    });
  }, [hasShareIntent, shareIntent, resetShareIntent, router]);
}
