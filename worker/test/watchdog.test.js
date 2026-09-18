import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryStorage } from "../src/feed/core.js";
import {
  alertForm,
  classify,
  runWatchdog,
  transition,
} from "../src/lib/watchdog.js";

test("watchdog classify: 200+ok is up; 503 with problems reports them; network failure reports it", () => {
  assert.deepEqual(classify(200, { ok: true }), { up: true, reason: null });
  assert.deepEqual(
    classify(503, {
      ok: false,
      status: "degraded",
      problems: ["feed: stale", "telegram: webhook is X"],
    }),
    {
      up: false,
      reason: "feed: stale; telegram: webhook is X",
    }
  );
  assert.equal(
    classify(0, { problems: ["fetch failed: timeout"] }).reason,
    "fetch failed: timeout"
  );
  assert.equal(classify(502, null).reason, "HTTP 502");
});

test("watchdog transition: down needs 2 consecutive fails, recovery is immediate, first sight silent", () => {
  const first = transition(null, { up: false });
  assert.equal(first.fire, false, "no alert on first sight");
  const up = { up: true, since: 1, fails: 0 };
  const f1 = transition(up, { up: false });
  assert.equal(f1.fire, false);
  assert.equal(f1.next.up, true, "still considered up after one fail");
  assert.equal(f1.next.fails, 1);
  assert.equal(
    transition(f1.next, { up: true }).next.fails,
    0,
    "healthy probe resets (deploy blip)"
  );
  const f2 = transition(f1.next, { up: false });
  assert.equal(f2.fire, true, "second consecutive fail alerts");
  assert.equal(f2.next.up, false);
  assert.equal(
    transition(f2.next, { up: false }).fire,
    false,
    "still down: silent"
  );
  const rec = transition(f2.next, { up: true });
  assert.equal(rec.fire, true, "recovery immediate");
  assert.equal(rec.next.up, true);
});

test("watchdog end to end: down -> one alert, still down -> nothing, up -> one recovery", async () => {
  const sent = [];
  const origFetch = globalThis.fetch;
  let healthy = true;
  globalThis.fetch = async (url) => {
    if (String(url).includes("api.telegram.org")) {
      sent.push(url);
      return { json: async () => ({ ok: true }) };
    }
    return healthy
      ? { status: 200, json: async () => ({ ok: true }) }
      : {
          status: 503,
          json: async () => ({
            ok: false,
            problems: ["feed: no pushes for >5 min"],
          }),
        };
  };
  const storage = memoryStorage();
  const env = {
    ALERT_TELEGRAM_CHAT: "1",
    PUBLIC_HOST: "h.example",
    TELEGRAM_TOKEN: "t",
    ENVIRONMENT: "test",
    VERSION: "x",
  };
  try {
    await runWatchdog({ env, storage }); // baseline: healthy, silent
    assert.equal(sent.length, 0);
    healthy = false;
    const r0 = await runWatchdog({ env, storage });
    assert.deepEqual([r0.up, r0.fired], [false, false], "first fail: not yet");
    const r1 = await runWatchdog({ env, storage });
    assert.deepEqual([r1.up, r1.fired], [false, true], "second fail: alert");
    await runWatchdog({ env, storage });
    assert.equal(sent.length, 1, "no repeat while still down");
    healthy = true;
    const r3 = await runWatchdog({ env, storage });
    assert.deepEqual([r3.up, r3.fired], [true, true]);
    assert.equal(sent.length, 2);
    assert.deepEqual(await runWatchdog({ env: {}, storage }), {
      skipped: "unconfigured",
    });
  } finally {
    globalThis.fetch = origFetch;
  }
  const f = alertForm(
    "h.example",
    { up: false, reason: "feed: stale" },
    null,
    env
  );
  assert.match(f.content, /h\.example: feed: stale/);
});
