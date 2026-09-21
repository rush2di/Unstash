import { describe, expect, it } from 'vitest';

import {
  decodeHtmlEntities,
  extractAuthorUsername,
  extractCaption,
  extractMediaType,
  parseOpenGraphTags,
  sanitizeText,
} from '@/server/instagram/og-parser';

const page = (tags: string) => `<!doctype html><html><head>${tags}</head><body></body></html>`;

describe('parseOpenGraphTags', () => {
  it('reads the Open Graph tags Instagram publishes', () => {
    const html = page(`
      <meta property="og:title" content="janedoe on Instagram: &quot;a nice caption&quot;" />
      <meta property="og:description" content="120 likes, 4 comments" />
      <meta property="og:image" content="https://cdn.example/thumb.jpg" />
      <meta property="og:type" content="video" />
    `);

    expect(parseOpenGraphTags(html)).toEqual({
      title: 'janedoe on Instagram: "a nice caption"',
      description: '120 likes, 4 comments',
      image: 'https://cdn.example/thumb.jpg',
      type: 'video',
    });
  });

  it('accepts single quotes and the name attribute', () => {
    const html = page(`<meta name='og:image' content='https://cdn.example/a.jpg'>`);
    expect(parseOpenGraphTags(html).image).toBe('https://cdn.example/a.jpg');
  });

  it('keeps the first value when a tag repeats', () => {
    const html = page(`
      <meta property="og:image" content="https://cdn.example/first.jpg" />
      <meta property="og:image" content="https://cdn.example/second.jpg" />
    `);
    expect(parseOpenGraphTags(html).image).toBe('https://cdn.example/first.jpg');
  });

  it('returns nothing for a page with no Open Graph tags', () => {
    expect(parseOpenGraphTags(page('<title>Instagram</title>'))).toEqual({});
  });

  it('ignores meta tags with no content', () => {
    expect(parseOpenGraphTags(page('<meta property="og:title" />'))).toEqual({});
  });
});

describe('sanitizeText', () => {
  it('removes control characters', () => {
    expect(sanitizeText('a\u0000b\u001fc')).toBe('abc');
  });

  it('collapses whitespace', () => {
    expect(sanitizeText('  a \n\n b  ')).toBe('a b');
  });

  it('truncates very long values', () => {
    expect(sanitizeText('x'.repeat(5000))).toHaveLength(2000);
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('a &amp; b &quot;c&quot;')).toBe('a & b "c"');
  });

  it('decodes numeric and hex entities', () => {
    expect(decodeHtmlEntities('&#65;&#x42;')).toBe('AB');
  });

  it('leaves unknown entities alone', () => {
    expect(decodeHtmlEntities('&notarealentity;')).toBe('&notarealentity;');
  });
});

describe('extractAuthorUsername', () => {
  it('reads the handle from the "on Instagram" form', () => {
    expect(extractAuthorUsername({ title: 'jane.doe_1 on Instagram: "hi"' })).toBe('jane.doe_1');
  });

  it('reads the handle from the "photo by" form', () => {
    expect(extractAuthorUsername({ title: 'Instagram photo by janedoe • Sep 20, 2026' })).toBe(
      'janedoe'
    );
  });

  it('returns undefined rather than guessing', () => {
    expect(extractAuthorUsername({ title: 'Instagram' })).toBeUndefined();
    expect(extractAuthorUsername({})).toBeUndefined();
  });
});

describe('extractCaption', () => {
  it('takes the quoted caption from the title', () => {
    expect(extractCaption({ title: 'janedoe on Instagram: "a nice caption"' })).toBe(
      'a nice caption'
    );
  });

  it('falls back to the description', () => {
    expect(extractCaption({ title: 'Instagram', description: '120 likes' })).toBe('120 likes');
  });

  it('returns undefined when there is nothing usable', () => {
    expect(extractCaption({ title: 'Instagram' })).toBeUndefined();
  });
});

describe('extractMediaType', () => {
  it('detects video from og:video', () => {
    expect(extractMediaType({ video: 'https://cdn.example/v.mp4' }, 'unknown')).toBe('video');
  });

  it('detects video from og:type', () => {
    expect(extractMediaType({ type: 'video.other' }, 'unknown')).toBe('video');
  });

  it('treats an image-only page as an image', () => {
    expect(extractMediaType({ image: 'https://cdn.example/a.jpg' }, 'unknown')).toBe('image');
  });

  it('keeps the caller fallback when the page says article', () => {
    expect(extractMediaType({ type: 'article' }, 'video')).toBe('video');
  });

  it('keeps the caller fallback when nothing is known', () => {
    expect(extractMediaType({}, 'video')).toBe('video');
  });
});

describe('extractAuthorUsername from og:url', () => {
  it('reads the handle from the canonical post URL', () => {
    expect(
      extractAuthorUsername({ url: 'https://www.instagram.com/riyadulpias/p/DM5hMXWMo4P/' })
    ).toBe('riyadulpias');
  });

  it('reads the handle from a reel URL', () => {
    expect(extractAuthorUsername({ url: 'https://www.instagram.com/jane.doe/reel/ABC123/' })).toBe(
      'jane.doe'
    );
  });

  it('prefers og:url over the title form', () => {
    expect(
      extractAuthorUsername({
        url: 'https://www.instagram.com/fromurl/p/ABC123/',
        title: 'fromtitle on Instagram: "hi"',
      })
    ).toBe('fromurl');
  });

  it('falls back to the description form', () => {
    expect(
      extractAuthorUsername({ description: '120 likes, 4 comments - janedoe on Instagram: "hi"' })
    ).toBe('janedoe');
  });

  it('ignores a URL without a content path', () => {
    expect(extractAuthorUsername({ url: 'https://www.instagram.com/janedoe/' })).toBeUndefined();
  });
});

describe('extractMediaType with real Instagram tags', () => {
  it('treats an article page with an image as an image post', () => {
    expect(extractMediaType({ type: 'article', image: 'https://cdn.example/a.jpg' }, 'unknown')).toBe(
      'image'
    );
  });

  it('keeps a reel as video despite og:type article', () => {
    expect(extractMediaType({ type: 'article', image: 'https://cdn.example/a.jpg' }, 'video')).toBe(
      'video'
    );
  });
});
