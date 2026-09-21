import { describe, expect, it } from 'vitest';

import { extractHashtags, stripHashtags, topHashtags } from '@/features/tags/hashtags';

describe('extractHashtags', () => {
  it('extracts lower-cased tags in order', () => {
    expect(extractHashtags('New chair #Interior #kitchen #minimalist')).toEqual(['interior', 'kitchen', 'minimalist']);
  });

  it('de-duplicates case-insensitively', () => {
    expect(extractHashtags('#Craft #craft #CRAFT')).toEqual(['craft']);
  });

  it('handles tags separated by pipes, as in real captions', () => {
    expect(extractHashtags('#SEOtips | #WebDesign | #PermalinkPower')).toEqual(['seotips', 'webdesign', 'permalinkpower']);
  });

  it('supports non-Latin scripts and underscores', () => {
    expect(extractHashtags('#café #東京 #wabi_sabi')).toEqual(['café', '東京', 'wabi_sabi']);
  });

  it('ignores digit-only tags', () => {
    expect(extractHashtags('We are #1 at #ceramics')).toEqual(['ceramics']);
  });

  it('ignores anchors and HTML entities that are not tags', () => {
    expect(extractHashtags('see page.html#section and &#39;quote')).toEqual([]);
  });

  it('returns nothing for an empty caption', () => {
    expect(extractHashtags(undefined)).toEqual([]);
    expect(extractHashtags('')).toEqual([]);
  });
});

describe('stripHashtags', () => {
  it('removes tags and trailing separators', () => {
    expect(stripHashtags('Wabi-sabi series no. 7 #ceramics #craft')).toBe('Wabi-sabi series no. 7');
  });

  it('keeps text around the tags', () => {
    expect(stripHashtags('Love this #kitchen setup')).toBe('Love this setup');
  });

  it('cleans a pipe-separated tag tail', () => {
    expect(stripHashtags('Start here. #SEOtips | #WebDesign | #Wordpress')).toBe('Start here.');
  });
});

describe('topHashtags', () => {
  it('ranks by count, then alphabetically', () => {
    const items = [
      { caption: '#craft #ceramics' },
      { caption: '#craft #kitchen' },
      { caption: '#ceramics' },
      { caption: undefined },
    ];
    expect(topHashtags(items)).toEqual([
      { tag: 'ceramics', count: 2 },
      { tag: 'craft', count: 2 },
      { tag: 'kitchen', count: 1 },
    ]);
  });

  it('counts a tag once per item', () => {
    expect(topHashtags([{ caption: '#a #a #a' }])).toEqual([{ tag: 'a', count: 1 }]);
  });

  it('respects the limit', () => {
    expect(topHashtags([{ caption: '#a #b #c' }], 2)).toHaveLength(2);
  });
});
