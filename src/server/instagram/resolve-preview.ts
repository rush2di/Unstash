import { fetchExabasePreview, isExabaseConfigured } from './exabase';
import {
  extractAuthorUsername,
  extractCaption,
  extractMediaType,
  type MediaType,
  parseOpenGraphTags,
} from './og-parser';

import { parseInstagramUrl } from '@/services/instagram/parse-url';

/**
 * Preview resolution. Server-only.
 *
 * Two sources, tried in order:
 *   1. Exabase link preview, when an API key is configured.
 *   2. Instagram's own public Open Graph tags.
 *
 * Either can break independently, so a failure in the first falls through to the second.
 * Neither uses credentials, cookies, private APIs or client impersonation.
 */

export type PreviewSource = 'exabase' | 'opengraph';

export type PreviewData = {
  normalizedUrl: string;
  shortcode: string;
  mediaType: MediaType;
  authorUsername?: string;
  caption?: string;
  thumbnailUrl?: string;
  /** Which source produced this, for debugging and metrics. */
  source: PreviewSource;
};

export type PreviewErrorCode = 'INVALID_URL' | 'PREVIEW_UNAVAILABLE';

export type PreviewResult =
  | { success: true; data: PreviewData }
  | { success: false; error: { code: PreviewErrorCode } };

const REQUEST_TIMEOUT_MS = 8000;
/** Instagram pages are large; read enough for the `<head>` and stop. */
const MAX_BYTES = 512 * 1024;

/**
 * An honest identifier. This service does not pretend to be a browser or an Instagram
 * client, and it sends no cookies or credentials.
 */
const USER_AGENT = 'RemindMeBot/1.0 (+https://github.com/remindme-app; link preview)';

export type FetchLike = typeof fetch;

/** Reads at most `MAX_BYTES` so a huge or endless response cannot exhaust memory. */
async function readCapped(response: Response): Promise<string> {
  const body = response.body;
  if (!body) {
    return '';
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      chunks.push(decoder.decode(value, { stream: true }));
      if (total >= MAX_BYTES) {
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return chunks.join('');
}

/** Reads Instagram's public Open Graph tags directly. */
async function resolveFromOpenGraph(
  normalizedUrl: string,
  fallbackMediaType: MediaType,
  fetchImpl: FetchLike
): Promise<Omit<PreviewData, 'normalizedUrl' | 'shortcode' | 'source'> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(normalizedUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en',
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) {
      return null;
    }

    const tags = parseOpenGraphTags(await readCapped(response));

    // A page with no usable metadata is a failed preview, not a failed request.
    if (!tags.image && !tags.title && !tags.description) {
      return null;
    }

    return {
      mediaType: extractMediaType(tags, fallbackMediaType),
      authorUsername: extractAuthorUsername(tags),
      caption: extractCaption(tags),
      thumbnailUrl: tags.image,
    };
  } catch {
    // Timeout, DNS failure, abort: all are "no preview for now".
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolves public preview metadata for one Instagram post or reel.
 *
 * Only a URL this parser normalises is ever fetched, and a normalised URL always points at
 * `www.instagram.com`. That is also the SSRF guard.
 */
export async function resolvePreview(
  rawUrl: string,
  fetchImpl: FetchLike = fetch
): Promise<PreviewResult> {
  const parsed = parseInstagramUrl(rawUrl);

  if (!parsed.isValid || !parsed.normalizedUrl || !parsed.shortcode) {
    return { success: false, error: { code: 'INVALID_URL' } };
  }

  const { normalizedUrl, shortcode } = parsed;
  const fallbackMediaType: MediaType = parsed.type === 'reel' ? 'video' : 'unknown';

  if (isExabaseConfigured()) {
    const preview = await fetchExabasePreview(normalizedUrl, fallbackMediaType, fetchImpl);
    if (preview) {
      return {
        success: true,
        data: { normalizedUrl, shortcode, source: 'exabase', ...preview },
      };
    }
  }

  const openGraph = await resolveFromOpenGraph(normalizedUrl, fallbackMediaType, fetchImpl);
  if (openGraph) {
    return {
      success: true,
      data: { normalizedUrl, shortcode, source: 'opengraph', ...openGraph },
    };
  }

  return { success: false, error: { code: 'PREVIEW_UNAVAILABLE' } };
}
