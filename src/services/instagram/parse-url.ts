/**
 * Instagram URL parsing. Pure module: no React, no Expo, no network.
 *
 * The normalised URL returned here is the canonical reference to a piece of Instagram
 * content and is what the app stores. See `PROJECT_PLAN.md` §6.
 */

export type InstagramContentType = 'post' | 'reel' | 'unknown';

export type ParsedInstagramUrl = {
  isValid: boolean;
  type?: InstagramContentType;
  shortcode?: string;
  normalizedUrl?: string;
};

/** Hosts we accept. Anything else is not an Instagram item. */
const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'www.instagr.am',
]);

/**
 * Path segments that identify shareable content.
 * `tv` is Instagram's legacy IGTV path and still resolves to a post.
 */
const TYPE_BY_SEGMENT: Record<string, InstagramContentType> = {
  p: 'post',
  tv: 'post',
  reel: 'reel',
  reels: 'reel',
};

/** Instagram shortcodes are base64url-ish and never contain a dot or slash. */
const SHORTCODE_PATTERN = /^[A-Za-z0-9_-]{5,30}$/;

const INVALID: ParsedInstagramUrl = { isValid: false };

/**
 * Pulls the first Instagram URL out of arbitrary shared text.
 *
 * Share sheets often deliver a caption followed by the link, so the raw share payload
 * is rarely a bare URL.
 */
export function extractInstagramUrl(text: string): string | null {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi);
  if (!matches) {
    return null;
  }
  return matches.find((candidate) => parseInstagramUrl(candidate).isValid) ?? null;
}

export function parseInstagramUrl(url: string): ParsedInstagramUrl {
  if (typeof url !== 'string') {
    return INVALID;
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return INVALID;
  }

  // Accept bare `instagram.com/p/ABC` as well as a full URL.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return INVALID;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return INVALID;
  }

  if (!INSTAGRAM_HOSTS.has(parsed.hostname.toLowerCase())) {
    return INVALID;
  }

  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);

  // Profile-scoped content: /{username}/p/{shortcode}/ and /{username}/reel/{shortcode}/
  const typeIndex = segments.findIndex((segment) => segment.toLowerCase() in TYPE_BY_SEGMENT);
  if (typeIndex === -1) {
    // A profile URL, a story, the explore page or the site root. None of these is a saveable item.
    return INVALID;
  }

  const type = TYPE_BY_SEGMENT[segments[typeIndex].toLowerCase()];
  const shortcode = segments[typeIndex + 1];

  if (!shortcode || !SHORTCODE_PATTERN.test(shortcode)) {
    return INVALID;
  }

  // `reels` is Instagram's newer path for the same content; normalise it to `reel`.
  const canonicalSegment = type === 'reel' ? 'reel' : 'p';

  return {
    isValid: true,
    type,
    shortcode,
    normalizedUrl: `https://www.instagram.com/${canonicalSegment}/${shortcode}/`,
  };
}

/** Convenience guard for call sites that only need a yes or no. */
export function isInstagramContentUrl(url: string): boolean {
  return parseInstagramUrl(url).isValid;
}
