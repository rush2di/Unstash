import { resolvePreview } from '@/server/instagram/resolve-preview';
import { RateLimiter } from '@/server/rate-limit';

/**
 * POST /api/instagram/preview
 *
 * Resolves public Instagram preview metadata so the mobile client never fetches
 * instagram.com itself, and so the Exabase API key stays on the server.
 *
 * Runs on EAS Hosting (Cloudflare Workers), so this file uses Web APIs only.
 */

const MAX_BODY_BYTES = 4 * 1024;

/**
 * Best-effort abuse guard.
 *
 * Each Worker isolate keeps its own counter, so this is not a strict global limit.
 * It is enough to blunt a single misbehaving client; a shared store (Workers KV) would be
 * needed for a real quota.
 */
const limiter = new RateLimiter({ limit: 30, windowMs: 60_000 });

function clientKey(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  );
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
  });
}

export async function POST(request: Request): Promise<Response> {
  const decision = limiter.check(clientKey(request));
  if (!decision.allowed) {
    return json({ success: false, error: { code: 'RATE_LIMITED' } }, 429, {
      'retry-after': String(decision.retryAfterSeconds),
    });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ success: false, error: { code: 'INVALID_URL' } }, 413);
  }

  let url: unknown;
  try {
    url = (JSON.parse(raw) as { url?: unknown }).url;
  } catch {
    return json({ success: false, error: { code: 'INVALID_URL' } }, 400);
  }

  if (typeof url !== 'string') {
    return json({ success: false, error: { code: 'INVALID_URL' } }, 400);
  }

  try {
    const result = await resolvePreview(url);

    if (result.success) {
      return json(result, 200);
    }

    return json(result, result.error.code === 'INVALID_URL' ? 400 : 502);
  } catch {
    return json({ success: false, error: { code: 'PREVIEW_UNAVAILABLE' } }, 500);
  }
}
