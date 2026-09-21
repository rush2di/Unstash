import { useEffect, useState } from 'react';

import { fetchPreview, type PreviewData } from '@/services/instagram/preview-client';

/** Typing delay before a URL is sent to the preview service. */
const DEBOUNCE_MS = 300;

type Completed = { url: string; data: PreviewData | null };

export type LivePreviewState = {
  /** True while a lookup for the current URL is still in flight. */
  loading: boolean;
  /** Resolved preview, or null when the lookup finished without one. */
  data: PreviewData | null;
};

/**
 * Resolves a preview for the save screen while the user fills the rest of the form.
 *
 * Saving never waits on this (PROJECT_PLAN.md §8): it exists so the user sees what they are
 * about to save. State is written only from the async callback, and "loading" is derived by
 * comparing the current URL with the one that produced the last result, which avoids a
 * synchronous state update inside the effect.
 */
export function useLivePreview(normalizedUrl: string | undefined): LivePreviewState {
  const [completed, setCompleted] = useState<Completed | null>(null);

  useEffect(() => {
    if (!normalizedUrl) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        // `fetchPreview` never throws; it returns null when the service is unset or fails.
        const data = await fetchPreview(normalizedUrl);
        if (!cancelled) {
          setCompleted({ url: normalizedUrl, data });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalizedUrl]);

  const isCurrent = completed !== null && completed.url === normalizedUrl;

  return {
    loading: Boolean(normalizedUrl) && !isCurrent,
    data: isCurrent ? completed.data : null,
  };
}
