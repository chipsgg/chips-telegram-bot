/**
 * Per-user sliding-window rate limit. Pure logic; storage is a Map in the FeedCore
 * (single instance per deployment, so the count is global across isolates).
 *
 *   const rl = new RateLimiter({ limit: 10, windowMs: 60_000 });
 *   rl.hit("discord:1234")  -> { allowed: true, remaining: 9, retryAfterSec: 0 }
 *                          -> { allowed: false, remaining: 0, retryAfterSec: 37 }
 *
 * Keys that go quiet are swept so the Map never grows unbounded.
 */
export const DEFAULT_LIMIT = 10;
export const DEFAULT_WINDOW_MS = 60_000;

export class RateLimiter {
  constructor({
    limit = DEFAULT_LIMIT,
    windowMs = DEFAULT_WINDOW_MS,
    now = Date.now,
  } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.hits = new Map(); // key -> [timestamps]
    this.lastSweep = 0;
  }

  hit(key) {
    const t = this.now();
    this.maybeSweep(t);
    const arr = (this.hits.get(key) || []).filter((x) => t - x < this.windowMs);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(
          1,
          Math.ceil((arr[0] + this.windowMs - t) / 1000)
        ),
      };
    }
    arr.push(t);
    this.hits.set(key, arr);
    return {
      allowed: true,
      remaining: this.limit - arr.length,
      retryAfterSec: 0,
    };
  }

  maybeSweep(t) {
    if (t - this.lastSweep < this.windowMs) return;
    this.lastSweep = t;
    for (const [k, arr] of this.hits) {
      if (!arr.length || t - arr[arr.length - 1] >= this.windowMs)
        this.hits.delete(k);
    }
  }
}

export const rateLimitMessage = (retryAfterSec) =>
  `Easy there. You've hit the command limit; try again in ${retryAfterSec}s.`;
