import { describe, expect, it } from 'vitest';

import { RateLimiter } from '@/server/rate-limit';

describe('RateLimiter', () => {
  it('allows requests up to the limit', () => {
    const limiter = new RateLimiter({ limit: 3, windowMs: 1000 });

    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('a', 10).allowed).toBe(true);
    expect(limiter.check('a', 20).allowed).toBe(true);
    expect(limiter.check('a', 30).allowed).toBe(false);
  });

  it('reports how long to wait', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check('a', 0);

    expect(limiter.check('a', 1000)).toEqual({ allowed: false, retryAfterSeconds: 59 });
  });

  it('starts a fresh window once the old one expires', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });
    limiter.check('a', 0);

    expect(limiter.check('a', 500).allowed).toBe(false);
    expect(limiter.check('a', 1500).allowed).toBe(true);
  });

  it('tracks each client separately', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 });

    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    expect(limiter.check('a', 0).allowed).toBe(false);
  });

  it('evicts expired windows so the map cannot grow without bound', () => {
    const limiter = new RateLimiter({ limit: 5, windowMs: 1000 });

    for (let i = 0; i < 100; i += 1) {
      limiter.check(`client-${i}`, 0);
    }
    expect(limiter.size).toBe(100);

    limiter.check('later', 2000);
    expect(limiter.size).toBe(1);
  });
});
