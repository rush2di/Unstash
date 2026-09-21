import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type FetchLike, resolvePreview } from '@/server/instagram/resolve-preview';

function htmlResponse(body: string, init: { status?: number; contentType?: string } = {}): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { 'content-type': init.contentType ?? 'text/html; charset=utf-8' },
  });
}

function exabaseResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Mirrors the live Exabase response shape for an Instagram post. */
const EXABASE_OK = {
  url: 'https://instagram.com/p/ABC123',
  title: 'A post shared by Riyadul Pias (@riyadulpias)',
  description: 'sunset run',
  siteName: 'Instagram',
  image: { url: 'https://cdn.exabase.io/link-previews/x.jpeg?token=t', width: 1200, height: 1200 },
};

/** Exabase returns HTTP 200 with a null image when the post is gone or private. */
const EXABASE_UNAVAILABLE = {
  url: 'https://instagram.com/p/ABC123',
  title: 'Instagram',
  description: 'Private media',
  siteName: 'Instagram',
  image: null,
};

const OG_PAGE = `<!doctype html><html><head>
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://www.instagram.com/janedoe/p/ABC123/" />
  <meta property="og:image" content="https://cdn.example/thumb.jpg" />
  <meta property="og:description" content="sunset run" />
</head><body></body></html>`;

const POST_URL = 'https://www.instagram.com/p/ABC123/';

beforeEach(() => {
  delete process.env.EXABASE_API_KEY;
});

afterEach(() => {
  delete process.env.EXABASE_API_KEY;
  vi.clearAllMocks();
});

describe('resolvePreview — URL validation', () => {
  it('rejects a non-Instagram URL without making a request', async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const result = await resolvePreview('https://internal.service.local/admin', fetchImpl);

    expect(result).toEqual({ success: false, error: { code: 'INVALID_URL' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects private network addresses without making a request', async () => {
    const fetchImpl = vi.fn<FetchLike>();

    for (const url of ['http://127.0.0.1/p/ABC123/', 'http://169.254.169.254/p/ABC123/']) {
      expect(await resolvePreview(url, fetchImpl)).toEqual({
        success: false,
        error: { code: 'INVALID_URL' },
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an Instagram profile URL', async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const result = await resolvePreview('https://www.instagram.com/janedoe/', fetchImpl);

    expect(result).toEqual({ success: false, error: { code: 'INVALID_URL' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('resolvePreview — Open Graph source', () => {
  it('resolves from Instagram Open Graph tags when Exabase is not configured', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(htmlResponse(OG_PAGE));

    const result = await resolvePreview('https://instagram.com/p/ABC123/?igshid=x', fetchImpl);

    expect(result).toEqual({
      success: true,
      data: {
        normalizedUrl: POST_URL,
        shortcode: 'ABC123',
        source: 'opengraph',
        mediaType: 'image',
        authorUsername: 'janedoe',
        caption: 'sunset run',
        thumbnailUrl: 'https://cdn.example/thumb.jpg',
      },
    });
  });

  it('only ever fetches the normalised instagram.com URL', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(htmlResponse(OG_PAGE));

    await resolvePreview('https://instagram.com/p/ABC123/?igshid=tracking', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(POST_URL);
  });

  it('sends no cookies or authorization headers', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(htmlResponse(OG_PAGE));

    await resolvePreview(POST_URL, fetchImpl);

    const headers = (fetchImpl.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
    const keys = Object.keys(headers).map((key) => key.toLowerCase());
    expect(keys).not.toContain('cookie');
    expect(keys).not.toContain('authorization');
    expect(headers['user-agent']).toMatch(/RemindMeBot/);
  });

  it('reports unavailable when the page is missing', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(htmlResponse('not found', { status: 404 }));

    expect(await resolvePreview(POST_URL, fetchImpl)).toEqual({
      success: false,
      error: { code: 'PREVIEW_UNAVAILABLE' },
    });
  });

  it('reports unavailable when the page carries no metadata', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(htmlResponse('<html><head></head><body>login</body></html>'));

    expect(await resolvePreview(POST_URL, fetchImpl)).toEqual({
      success: false,
      error: { code: 'PREVIEW_UNAVAILABLE' },
    });
  });

  it('rejects a non-HTML response', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(htmlResponse('{}', { contentType: 'application/json' }));

    expect(await resolvePreview(POST_URL, fetchImpl)).toEqual({
      success: false,
      error: { code: 'PREVIEW_UNAVAILABLE' },
    });
  });

  it('turns a network failure into an unavailable preview', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockRejectedValue(new Error('ECONNRESET'));

    expect(await resolvePreview(POST_URL, fetchImpl)).toEqual({
      success: false,
      error: { code: 'PREVIEW_UNAVAILABLE' },
    });
  });

  it('treats a reel as video even when the page only advertises an image', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(
        htmlResponse('<meta property="og:image" content="https://cdn.example/a.jpg">')
      );

    const result = await resolvePreview('https://www.instagram.com/reel/ABC123/', fetchImpl);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mediaType).toBe('video');
    }
  });
});

describe('resolvePreview — Exabase source', () => {
  beforeEach(() => {
    process.env.EXABASE_API_KEY = 'test-key';
  });

  it('prefers Exabase and never touches instagram.com on success', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(exabaseResponse(EXABASE_OK));

    const result = await resolvePreview(POST_URL, fetchImpl);

    expect(result).toEqual({
      success: true,
      data: {
        normalizedUrl: POST_URL,
        shortcode: 'ABC123',
        source: 'exabase',
        mediaType: 'image',
        authorUsername: 'riyadulpias',
        caption: 'sunset run',
        thumbnailUrl: 'https://cdn.exabase.io/link-previews/x.jpeg?token=t',
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('api.exabase.io/v2/link');
  });

  it('sends the key as x-api-key and never in the URL', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(exabaseResponse(EXABASE_OK));

    await resolvePreview(POST_URL, fetchImpl);

    const [endpoint, init] = fetchImpl.mock.calls[0] ?? [];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
    expect(String(endpoint)).not.toContain('test-key');
  });

  it('falls back to Open Graph when Exabase reports the media unavailable', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(exabaseResponse(EXABASE_UNAVAILABLE))
      .mockResolvedValueOnce(htmlResponse(OG_PAGE));

    const result = await resolvePreview(POST_URL, fetchImpl);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('opengraph');
      expect(result.data.authorUsername).toBe('janedoe');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('falls back to Open Graph when Exabase errors', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(exabaseResponse({ error: 'boom' }, 500))
      .mockResolvedValueOnce(htmlResponse(OG_PAGE));

    const result = await resolvePreview(POST_URL, fetchImpl);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('opengraph');
    }
  });

  it('falls back to Open Graph when the Exabase request throws', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce(htmlResponse(OG_PAGE));

    const result = await resolvePreview(POST_URL, fetchImpl);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('opengraph');
    }
  });

  it('reports unavailable only when both sources fail', async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(exabaseResponse(EXABASE_UNAVAILABLE))
      .mockResolvedValueOnce(htmlResponse('nothing', { status: 404 }));

    expect(await resolvePreview(POST_URL, fetchImpl)).toEqual({
      success: false,
      error: { code: 'PREVIEW_UNAVAILABLE' },
    });
  });

  it('keeps a reel as video through the Exabase path', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue(exabaseResponse(EXABASE_OK));

    const result = await resolvePreview('https://www.instagram.com/reel/ABC123/', fetchImpl);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mediaType).toBe('video');
    }
  });
});
