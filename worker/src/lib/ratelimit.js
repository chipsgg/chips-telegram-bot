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

// Tiers: chat commands are per user (tight); the HTTP demo API is per IP (loose, shared NATs).
export const TIERS = {
  user: { limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS },
  api: { limit: 60, windowMs: DEFAULT_WINDOW_MS },
};

export class RateLimiter {
  constructor({
    limit = DEFAULT_LIMIT,
    windowMs = DEFAULT_WINDOW_MS,
    now = Date.now,
    tiers,
  } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    // explicit ctor limit/window define the "user" tier unless tiers are given outright
    this.tiers = tiers || { ...TIERS, user: { limit, windowMs } };
    this.hits = new Map(); // key -> [timestamps]
    this.lastSweep = 0;
  }

  hit(key, tier = "user") {
    const { limit = this.limit, windowMs = this.windowMs } =
      this.tiers[tier] || {};
    const t = this.now();
    this.maybeSweep(t);
    const arr = (this.hits.get(key) || []).filter((x) => t - x < windowMs);
    if (arr.length >= limit) {
      this.hits.set(key, arr);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((arr[0] + windowMs - t) / 1000)),
      };
    }
    arr.push(t);
    this.hits.set(key, arr);
    return { allowed: true, remaining: limit - arr.length, retryAfterSec: 0 };
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
