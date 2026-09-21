/**
 * Fixed-window rate limiter. Pure module: the caller supplies the clock.
 *
 * The preview endpoint reaches out to a third party, so it is rate limited per client
 * (PROJECT_PLAN.md §24).
 */

export type RateLimitDecision = {
  allowed: boolean;
  /** Seconds until the current window resets. */
  retryAfterSeconds: number;
};

export type RateLimiterOptions = {
  limit: number;
  windowMs: number;
};

type Window = { count: number; resetAt: number };

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly options: RateLimiterOptions) {}

  check(key: string, now: number = Date.now()): RateLimitDecision {
    this.evictExpired(now);

    const existing = this.windows.get(key);

    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.options.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= this.options.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Keeps the map from growing without bound as clients come and go. */
  private evictExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
  }

  get size(): number {
    return this.windows.size;
  }
}
