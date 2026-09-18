import assert from "node:assert/strict";
import { test } from "node:test";
import { RateLimiter, rateLimitMessage } from "../src/lib/ratelimit.js";

const clock = (start = 1_000_000) => {
  let t = start;
  return {
    now: () => t,
    tick: (ms) => {
      t += ms;
    },
  };
};

test("ratelimit: allows up to limit per window, then blocks with retryAfter", () => {
  const c = clock();
  const rl = new RateLimiter({ limit: 3, windowMs: 60_000, now: c.now });
  assert.deepEqual(rl.hit("u1"), {
    allowed: true,
    remaining: 2,
    retryAfterSec: 0,
  });
  c.tick(10_000);
  assert.equal(rl.hit("u1").remaining, 1);
  c.tick(10_000);
  assert.equal(rl.hit("u1").remaining, 0);
  const blocked = rl.hit("u1");
  assert.equal(blocked.allowed, false);
  assert.equal(
    blocked.retryAfterSec,
    40,
    "first hit was 20s ago; window is 60s"
  );
  // other users unaffected
  assert.equal(rl.hit("u2").allowed, true);
});

test("ratelimit: window slides; sweep drops idle keys", () => {
  const c = clock();
  const rl = new RateLimiter({ limit: 2, windowMs: 1_000, now: c.now });
  rl.hit("a");
  rl.hit("a");
  assert.equal(rl.hit("a").allowed, false);
  c.tick(1_001);
  assert.equal(rl.hit("a").allowed, true, "oldest hit expired");
  rl.hit("idle");
  c.tick(5_000);
  rl.hit("b"); // triggers sweep
  assert.equal(rl.hits.has("idle"), false, "idle key swept");
  assert.equal(rl.hits.has("b"), true);
});

test("ratelimit: message is human", () => {
  assert.match(rateLimitMessage(37), /37s/);
});
