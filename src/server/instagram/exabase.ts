import type { MediaType } from './og-parser';

import { cleanInstagramCaption } from '@/services/instagram/caption';

/**
 * Exabase link preview client. Server-only: it carries the API key.
 *
 * Endpoint and field names were taken from the `@exabase/sdk` package and verified against
 * live Instagram URLs, not from the published docs (which list a different path and auth
 * header).
 */

const ENDPOINT = 'https://api.exabase.io/v2/link';
const REQUEST_TIMEOUT_MS = 12_000;

/** Shape returned by `GET /v2/link`, narrowed to the fields we use. */
type ExabaseLinkPreview = {
  url?: string | null;
  title?: string | null;
  description?: string | null;
  siteName?: string | null;
  image?: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
};

export type ExabasePreview = {
  authorUsername?: string;
  caption?: string;
  thumbnailUrl?: string;
  mediaType: MediaType;
};

export function isExabaseConfigured(): boolean {
  const key = process.env.EXABASE_API_KEY;
  return typeof key === 'string' && key.length > 0;
}

/**
 * Instagram serves no `og:title` on post pages, so Exabase composes one:
 *   "A post shared by Riyadul Pias (@riyadulpias)"
 * The handle in parentheses is the only reliable author signal in the response.
 */
export function extractAuthorFromTitle(title: string | null | undefined): string | undefined {
  if (!title) {
    return undefined;
  }
  const match = title.match(/\(@([A-Za-z0-9._]{1,30})\)/);
  return match ? match[1] : undefined;
}

/**
 * A post that is deleted, private, or otherwise unavailable still returns HTTP 200,
 * with a generic title, `"Private media"` as the description and a null image.
 */
function isUnavailable(body: ExabaseLinkPreview, authorUsername: string | undefined): boolean {
  const hasImage = Boolean(body.image?.url);
  return !hasImage && authorUsername === undefined;
}

/**
 * Resolves a preview through Exabase.
 *
 * Returns null when the service is unconfigured, errors, or reports the media as
 * unavailable. The caller then falls back to the Open Graph resolver.
 */
export async function fetchExabasePreview(
  normalizedUrl: string,
  fallbackMediaType: MediaType,
  fetchImpl: typeof fetch = fetch
): Promise<ExabasePreview | null> {
  const apiKey = process.env.EXABASE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const endpoint = `${ENDPOINT}?url=${encodeURIComponent(normalizedUrl)}`;
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as ExabaseLinkPreview;
    const authorUsername = extractAuthorFromTitle(body.title);

    if (isUnavailable(body, authorUsername)) {
      return null;
    }

    const thumbnailUrl = body.image?.url ?? undefined;

    return {
      authorUsername,
      caption: cleanInstagramCaption(body.description),
      thumbnailUrl,
      // Exabase reports no video signal, so a reel stays a video and anything
      // with an image is treated as an image post.
      mediaType:
        fallbackMediaType === 'video' ? 'video' : thumbnailUrl ? 'image' : fallbackMediaType,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
