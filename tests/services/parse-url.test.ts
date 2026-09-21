import { describe, expect, it } from 'vitest';

import {
  extractInstagramUrl,
  isInstagramContentUrl,
  parseInstagramUrl,
} from '@/services/instagram/parse-url';

describe('parseInstagramUrl', () => {
  it('accepts a valid post URL', () => {
    expect(parseInstagramUrl('https://instagram.com/p/ABC123/')).toEqual({
      isValid: true,
      type: 'post',
      shortcode: 'ABC123',
      normalizedUrl: 'https://www.instagram.com/p/ABC123/',
    });
  });

  it('accepts the www host', () => {
    expect(parseInstagramUrl('https://www.instagram.com/p/ABC123/').isValid).toBe(true);
  });

  it('accepts a valid reel URL', () => {
    expect(parseInstagramUrl('https://www.instagram.com/reel/ABC123/')).toEqual({
      isValid: true,
      type: 'reel',
      shortcode: 'ABC123',
      normalizedUrl: 'https://www.instagram.com/reel/ABC123/',
    });
  });

  it('normalises the /reels/ path to /reel/', () => {
    const parsed = parseInstagramUrl('https://www.instagram.com/reels/ABC123/');
    expect(parsed.type).toBe('reel');
    expect(parsed.normalizedUrl).toBe('https://www.instagram.com/reel/ABC123/');
  });

  it('accepts a URL without a trailing slash', () => {
    const parsed = parseInstagramUrl('https://www.instagram.com/p/ABC123');
    expect(parsed.isValid).toBe(true);
    expect(parsed.normalizedUrl).toBe('https://www.instagram.com/p/ABC123/');
  });

  it('strips tracking query parameters', () => {
    const parsed = parseInstagramUrl(
      'https://instagram.com/reel/ABC123/?igshid=abc&utm_source=ig_web_copy_link'
    );
    expect(parsed.normalizedUrl).toBe('https://www.instagram.com/reel/ABC123/');
  });

  it('strips a URL fragment', () => {
    expect(parseInstagramUrl('https://www.instagram.com/p/ABC123/#comments').normalizedUrl).toBe(
      'https://www.instagram.com/p/ABC123/'
    );
  });

  it('accepts profile-scoped content URLs', () => {
    const parsed = parseInstagramUrl('https://www.instagram.com/someuser/reel/ABC123/');
    expect(parsed.type).toBe('reel');
    expect(parsed.shortcode).toBe('ABC123');
  });

  it('accepts a bare host without a scheme', () => {
    expect(parseInstagramUrl('instagram.com/p/ABC123/').isValid).toBe(true);
  });

  it('accepts the legacy /tv/ path as a post', () => {
    expect(parseInstagramUrl('https://www.instagram.com/tv/ABC123/').type).toBe('post');
  });

  it('rejects a malformed URL', () => {
    expect(parseInstagramUrl('not a url at all').isValid).toBe(false);
    expect(parseInstagramUrl('https://').isValid).toBe(false);
    expect(parseInstagramUrl('').isValid).toBe(false);
  });

  it('rejects a non-Instagram URL', () => {
    expect(parseInstagramUrl('https://example.com/p/ABC123/').isValid).toBe(false);
    expect(parseInstagramUrl('https://tiktok.com/@user/video/123').isValid).toBe(false);
  });

  it('rejects a lookalike host', () => {
    expect(parseInstagramUrl('https://instagram.com.evil.example/p/ABC123/').isValid).toBe(false);
    expect(parseInstagramUrl('https://notinstagram.com/p/ABC123/').isValid).toBe(false);
  });

  it('rejects an Instagram profile URL', () => {
    expect(parseInstagramUrl('https://www.instagram.com/someuser/').isValid).toBe(false);
    expect(parseInstagramUrl('https://www.instagram.com/').isValid).toBe(false);
  });

  it('rejects an Instagram story URL', () => {
    expect(parseInstagramUrl('https://www.instagram.com/stories/someuser/12345/').isValid).toBe(
      false
    );
  });

  it('rejects a content path with no shortcode', () => {
    expect(parseInstagramUrl('https://www.instagram.com/p/').isValid).toBe(false);
  });

  it('rejects a non-http scheme', () => {
    expect(parseInstagramUrl('javascript:alert(1)//instagram.com/p/ABC123/').isValid).toBe(false);
  });

  it('rejects a non-string input', () => {
    expect(parseInstagramUrl(undefined as unknown as string).isValid).toBe(false);
  });
});

describe('extractInstagramUrl', () => {
  it('finds the URL inside shared caption text', () => {
    const shared = 'Check this out\n\nhttps://www.instagram.com/reel/ABC123/?igshid=xyz';
    expect(extractInstagramUrl(shared)).toBe('https://www.instagram.com/reel/ABC123/?igshid=xyz');
  });

  it('ignores non-Instagram URLs in the text', () => {
    expect(extractInstagramUrl('see https://example.com and nothing else')).toBeNull();
  });

  it('returns null when the text has no URL', () => {
    expect(extractInstagramUrl('just some words')).toBeNull();
  });
});

describe('isInstagramContentUrl', () => {
  it('mirrors parseInstagramUrl validity', () => {
    expect(isInstagramContentUrl('https://www.instagram.com/p/ABC123/')).toBe(true);
    expect(isInstagramContentUrl('https://example.com')).toBe(false);
  });
});
