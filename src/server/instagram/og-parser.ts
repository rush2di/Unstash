/**
 * Open Graph metadata extraction. Pure module: no network, no Node APIs.
 *
 * Instagram serves Open Graph tags on its public post pages for link unfurling. Those tags
 * are the only metadata this service reads. Nothing here touches a private API.
 */

import { cleanInstagramCaption } from '@/services/instagram/caption';

export type OpenGraphTags = {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
  video?: string;
  /** Canonical URL. Instagram writes it as `/{username}/p/{shortcode}/`. */
  url?: string;
};

/** Longest value we keep from a remote page. Anything longer is truncated. */
const MAX_TEXT_LENGTH = 2000;

const META_TAG = /<meta\b[^>]*>/gi;
const ATTRIBUTE = /([a-zA-Z-:]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
};

/** Decodes the entity set Instagram actually emits, plus numeric references. */
export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    const known = HTML_ENTITIES[entity.toLowerCase()];
    if (known !== undefined) {
      return known;
    }

    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    return match;
  });
}

/**
 * Removes control characters and collapses whitespace.
 *
 * Remote text is rendered in the app, so it is sanitised before it is ever stored
 * (PROJECT_PLAN.md §24).
 */
export function sanitizeText(value: string): string {
  const withoutControls = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return withoutControls.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
}

function readAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  ATTRIBUTE.lastIndex = 0;

  let match = ATTRIBUTE.exec(tag);
  while (match !== null) {
    const [, name, doubleQuoted, singleQuoted, bare] = match;
    attributes[name.toLowerCase()] = doubleQuoted ?? singleQuoted ?? bare ?? '';
    match = ATTRIBUTE.exec(tag);
  }

  return attributes;
}

/** Pulls the `og:*` tags out of an HTML document. */
export function parseOpenGraphTags(html: string): OpenGraphTags {
  const tags: OpenGraphTags = {};
  META_TAG.lastIndex = 0;

  let match = META_TAG.exec(html);
  while (match !== null) {
    const attributes = readAttributes(match[0]);
    // Instagram uses `property`; some pages use `name` for the same keys.
    const key = (attributes.property ?? attributes.name ?? '').toLowerCase();
    const content = attributes.content;

    if (content !== undefined) {
      const value = sanitizeText(decodeHtmlEntities(content));
      if (value.length > 0) {
        switch (key) {
          case 'og:title':
            tags.title ??= value;
            break;
          case 'og:description':
            tags.description ??= value;
            break;
          case 'og:image':
            tags.image ??= value;
            break;
          case 'og:type':
            tags.type ??= value;
            break;
          case 'og:url':
            tags.url ??= value;
            break;
          case 'og:video':
          case 'og:video:secure_url':
            tags.video ??= value;
            break;
        }
      }
    }

    match = META_TAG.exec(html);
  }

  return tags;
}

/**
 * Resolves the author handle.
 *
 * In practice Instagram omits `og:title` on post pages and instead writes the canonical
 * `og:url` as `https://www.instagram.com/{username}/p/{shortcode}/`, so that is tried first.
 * The title and description forms are kept as fallbacks for pages that do carry them.
 *
 * Returns undefined rather than guessing when no form matches.
 */
export function extractAuthorUsername(tags: OpenGraphTags): string | undefined {
  const fromUrl = tags.url?.match(
    /^https?:\/\/[^/]*instagram\.com\/([A-Za-z0-9._]{1,30})\/(?:p|reel|reels|tv)\//i
  );
  if (fromUrl) {
    return fromUrl[1];
  }

  const title = tags.title;
  if (title) {
    const onInstagram = title.match(/^@?([A-Za-z0-9._]{1,30})\s+on\s+Instagram/i);
    if (onInstagram) {
      return onInstagram[1];
    }

    const photoBy = title.match(/Instagram (?:photo|video) by\s+@?([A-Za-z0-9._]{1,30})/i);
    if (photoBy) {
      return photoBy[1];
    }
  }

  // e.g. "120 likes, 4 comments - janedoe on Instagram: \"a caption\""
  const fromDescription = tags.description?.match(
    /[-–—]\s*@?([A-Za-z0-9._]{1,30})\s+on\s+Instagram/i
  );
  if (fromDescription) {
    return fromDescription[1];
  }

  return undefined;
}

/** The caption sits inside the quotes of `og:title`, falling back to `og:description`. */
export function extractCaption(tags: OpenGraphTags): string | undefined {
  const quoted = tags.title?.match(/[:：]\s*[""“](.+)[""”]\s*$/);
  if (quoted) {
    const caption = sanitizeText(quoted[1]);
    return caption.length > 0 ? caption : undefined;
  }

  return cleanInstagramCaption(tags.description);
}

export type MediaType = 'image' | 'video' | 'carousel' | 'unknown';

export function extractMediaType(tags: OpenGraphTags, fallback: MediaType): MediaType {
  if (tags.video || tags.type?.startsWith('video')) {
    return 'video';
  }

  // A reel URL is a video whatever the page says. Instagram serves `og:type: article`
  // on post pages, so the tag alone cannot decide this.
  if (fallback === 'video') {
    return 'video';
  }

  return tags.image ? 'image' : fallback;
}
