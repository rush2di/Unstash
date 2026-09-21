/**
 * Hashtag extraction. Pure module: no React, no Expo.
 *
 * Tags are derived from the caption Instagram already carries, so nothing is stored and a
 * caption that updates on the next preview resolve updates its tags with it.
 */

import { cleanInstagramCaption } from '@/services/instagram/caption';
import type { SavedItem } from '@/types/domain';

/** Letters, digits and underscores in any script; Instagram's own rule for a tag body. */
const HASHTAG = /(?:^|[^\p{L}\p{N}_&])#([\p{L}\p{N}_]{1,60})/gu;

/** Lower-cased, de-duplicated hashtags in first-seen order. */
export function extractHashtags(caption: string | undefined): string[] {
  if (!caption) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const match of caption.matchAll(HASHTAG)) {
    const tag = match[1].toLowerCase();
    // A tag that is only digits is almost always a number ("#1"), not a topic.
    if (/^\d+$/.test(tag) || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}

export type TagCount = { tag: string; count: number };

/** Most-used tags across items, ties broken alphabetically so the order is stable. */
export function topHashtags(items: Pick<SavedItem, 'caption'>[], limit = 5): TagCount[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const tag of extractHashtags(item.caption)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/** Caption with hashtags removed, for display above the tag chips. */
export function stripHashtags(caption: string | undefined): string {
  if (!caption) {
    return '';
  }
  return caption
    .replace(HASHTAG, (whole) => (whole.startsWith('#') ? '' : whole[0]))
    .replace(/[|•·]\s*(?=[|•·\s]*$)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Caption as shown in the UI: engagement wrapper removed, hashtags moved out to chips.
 * Applied at display time too, so rows stored before the cleaner existed also read well.
 */
export function displayCaption(caption: string | undefined): string {
  return stripHashtags(cleanInstagramCaption(caption));
}
