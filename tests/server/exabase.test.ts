import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extractAuthorFromTitle, fetchExabasePreview, isExabaseConfigured } from '@/server/instagram/exabase';

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  delete process.env.EXABASE_API_KEY;
});

afterEach(() => {
  delete process.env.EXABASE_API_KEY;
  vi.clearAllMocks();
});

describe('extractAuthorFromTitle', () => {
  it('reads the handle Exabase puts in parentheses', () => {
    // Verified against the live API for https://www.instagram.com/p/DM5hMXWMo4P/
    expect(extractAuthorFromTitle('A post shared by Riyadul Pias (@riyadulpias)')).toBe(
      'riyadulpias'
    );
  });

  it('handles dots and underscores in handles', () => {
    expect(extractAuthorFromTitle('A post shared by X (@jane.doe_1)')).toBe('jane.doe_1');
  });

  it('returns undefined for the generic unavailable title', () => {
    expect(extractAuthorFromTitle('Instagram')).toBeUndefined();
  });

  it('returns undefined for null or empty input', () => {
    expect(extractAuthorFromTitle(null)).toBeUndefined();
    expect(extractAuthorFromTitle(undefined)).toBeUndefined();
    expect(extractAuthorFromTitle('')).toBeUndefined();
  });
});

describe('isExabaseConfigured', () => {
  it('is false without a key and true with one', () => {
    expect(isExabaseConfigured()).toBe(false);
    process.env.EXABASE_API_KEY = 'k';
    expect(isExabaseConfigured()).toBe(true);
  });
});

describe('fetchExabasePreview', () => {
  it('returns null and makes no request without a key', async () => {
    const fetchImpl = vi.fn();
    expect(await fetchExabasePreview('https://www.instagram.com/p/A/', 'unknown', fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a successful response', async () => {
    process.env.EXABASE_API_KEY = 'k';
    const fetchImpl = vi.fn().mockResolvedValue(
      ok({
        title: 'A post shared by Jane (@janedoe)',
        description: 'a caption',
        image: { url: 'https://cdn.exabase.io/a.jpeg', width: 1200, height: 1200 },
      })
    );

    expect(await fetchExabasePreview('https://www.instagram.com/p/A/', 'unknown', fetchImpl)).toEqual({
      authorUsername: 'janedoe',
      caption: 'a caption',
      thumbnailUrl: 'https://cdn.exabase.io/a.jpeg',
      mediaType: 'image',
    });
  });

  it('treats a null image with no author as unavailable', async () => {
    process.env.EXABASE_API_KEY = 'k';
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ title: 'Instagram', description: 'Private media', image: null }));

    expect(await fetchExabasePreview('https://www.instagram.com/p/A/', 'unknown', fetchImpl)).toBeNull();
  });

  it('still returns a preview when the author is known but the image is missing', async () => {
    process.env.EXABASE_API_KEY = 'k';
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ title: 'A post shared by Jane (@janedoe)', image: null }));

    const result = await fetchExabasePreview('https://www.instagram.com/p/A/', 'unknown', fetchImpl);
    expect(result?.authorUsername).toBe('janedoe');
    expect(result?.thumbnailUrl).toBeUndefined();
  });

  it('returns null on a non-OK response', async () => {
    process.env.EXABASE_API_KEY = 'k';
    const fetchImpl = vi.fn().mockResolvedValue(ok({ error: 'nope' }, 401));
    expect(await fetchExabasePreview('https://www.instagram.com/p/A/', 'unknown', fetchImpl)).toBeNull();
  });

  it('returns null when the request throws', async () => {
    process.env.EXABASE_API_KEY = 'k';
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    expect(await fetchExabasePreview('https://www.instagram.com/p/A/', 'unknown', fetchImpl)).toBeNull();
  });

  it('keeps a reel as video', async () => {
    process.env.EXABASE_API_KEY = 'k';
    const fetchImpl = vi.fn().mockResolvedValue(
      ok({ title: 'A post shared by Jane (@janedoe)', image: { url: 'https://cdn/a.jpeg' } })
    );

    const result = await fetchExabasePreview('https://www.instagram.com/reel/A/', 'video', fetchImpl);
    expect(result?.mediaType).toBe('video');
  });
});
