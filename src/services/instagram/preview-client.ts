import type { MediaType } from '@/types/domain';

/**
 * Client for the preview resolution service.
 *
 * The mobile client never fetches instagram.com itself (PROJECT_PLAN.md principle 7);
 * it only talks to our own API route, which also keeps the Exabase key server-side.
 */

export type PreviewData = {
  normalizedUrl: string;
  shortcode: string;
  mediaType: MediaType;
  authorUsername?: string;
  caption?: string;
  thumbnailUrl?: string;
};

export type PreviewResponse =
  | { success: true; data: PreviewData }
  | { success: false; error: { code: string } };

const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Base URL of the preview service, supplied at build time.
 * When it is unset the app still works; previews simply stay unresolved.
 */
export function getPreviewApiUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_PREVIEW_API_URL;
  return url && url.length > 0 ? url.replace(/\/$/, '') : null;
}

export function isPreviewServiceConfigured(): boolean {
  return getPreviewApiUrl() !== null;
}

/**
 * Resolves preview metadata for one Instagram URL.
 *
 * Returns `null` when the service is not configured or the request fails. A null result
 * means "not now", and the caller decides whether that is a retry or a failure.
 */
export async function fetchPreview(instagramUrl: string): Promise<PreviewData | null> {
  const baseUrl = getPreviewApiUrl();
  if (!baseUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/instagram/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: instagramUrl }),
      signal: controller.signal,
    });

    // 4xx and 5xx both mean no preview right now.
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as PreviewResponse;
    return body.success ? body.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
