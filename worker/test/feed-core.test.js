import assert from "node:assert/strict";
import { test } from "node:test";
import { FeedCore, memoryStorage, setPath } from "../src/feed/core.js";
import { memoryMetrics, sqliteMetrics } from "../src/lib/metrics.js";

// A fake websocket the core can drive: we push frames in, capture what it sends.
function fakeSocket() {
  const listeners = {};
  const ws = {
    readyState: 1,
    sent: [],
    send: (s) => ws.sent.push(JSON.parse(s)),
    close: () => {
      ws.readyState = 3;
      for (const fn of listeners.close || []) fn({});
    },
    addEventListener: (ev, fn) => {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(fn);
    },
    push: (frames) => {
      for (const fn of listeners.message || [])
        fn({ data: JSON.stringify(frames) });
    },
  };
  return ws;
}

const frame = (channel, path, data) => [channel, null, [path, data]];

test("feed core: connects, subscribes, applies root + path pushes, filters public", async () => {
  let ws;
  let scheduled = null;
  const core = new FeedCore({
    openSocket: async () => {
      ws = fakeSocket();
      return ws;
    },
    schedule: (ms) => {
      scheduled = ms;
    },
  });
  await core.ensureConnected();
  assert.equal(ws.sent.length, 4, "4 subscriptions sent");
  assert.deepEqual(ws.sent[0].slice(0, 1).concat(ws.sent[0].slice(2)), [
    "stats",
    "on",
    [{ game: "bets", type: "bigwins" }],
  ]);
  assert.equal(scheduled, 60_000);

  ws.push([
    frame("public", [], {
      currencies: { btc: { name: "btc", price: 1 } },
      settings: { x: 1 },
      junk: { huge: true },
    }),
    frame("stats", ["bets", "bigwins", "id1"], { amount: 5 }),
    ["stats", 7, "rpc reply, ignored"],
  ]);
  const snap = core.snapshot();
  assert.equal(snap.currencies, 1);
  assert.equal(snap.bigwins, 1);
  assert.equal(core.read("public.junk"), undefined, "unkept branch dropped");
  assert.equal(core.read("public.settings.x"), 1);

  ws.push([frame("stats", ["bets", "bigwins", "id1"], null)]);
  assert.equal(core.snapshot().bigwins, 0, "null unsets");

  const got = await core.get("public.currencies", "stats.bets.bigwins");
  assert.equal(got.stale, false);
  assert.equal(got.data["public.currencies"].btc.price, 1);
});

test("feed core: reconnects after close, activity persists in storage", async () => {
  const sockets = [];
  const storage = memoryStorage();
  const core = new FeedCore({
    openSocket: async () => {
      const ws = fakeSocket();
      sockets.push(ws);
      return ws;
    },
    storage,
  });
  await core.ensureConnected();
  sockets[0].close();
  assert.equal(core.ws, null);
  await core.alarm();
  assert.equal(sockets.length, 2, "alarm reopened the socket");
  assert.equal(core.reconnects, 2);

  await core.mark("telegram");
  await core.mark("telegram");
  await core.mark("bad platform!"); // rejected by the regex
  const s = await core.status();
  assert.equal(s.activity.telegram_count, 2);
  assert.equal(s.activity["bad platform!_count"], undefined);
  // a second core over the same storage sees the counters (DO eviction / process restart)
  const core2 = new FeedCore({ openSocket: async () => fakeSocket(), storage });
  assert.equal((await core2.loadActivity()).telegram_count, 2);
});

test("feed core: staleness has a connect grace window", async () => {
  const core = new FeedCore({ openSocket: async () => fakeSocket() });
  assert.equal(core.isStale(), true, "never connected");
  await core.ensureConnected();
  assert.equal(core.isStale(), false, "just connected, no push yet: grace");
  core.connectedAt = Date.now() - 20_000;
  assert.equal(core.isStale(), true, "20s connected, no push: stale");
  core.updatedAt = Date.now();
  assert.equal(core.isStale(), false);
});

test("setPath is non-mutating", () => {
  const a = { x: { y: 1 } };
  const b = setPath(a, ["x", "z"], 2);
  assert.deepEqual(a, { x: { y: 1 } });
  assert.deepEqual(b, { x: { y: 1, z: 2 } });
});

test("metrics: memory and sqlite backends agree on totals and per-command usage", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const backends = {
    memory: memoryMetrics(),
    sqlite: sqliteMetrics(new DatabaseSync(":memory:")),
  };
  for (const [name, m] of Object.entries(backends)) {
    await m.track("discord", "prices");
    await m.track("discord", "prices");
    await m.track("telegram", "prices");
    await m.track("api", "compare", false);
    const r = await m.read();
    assert.deepEqual(
      r,
      {
        messages_sent: 4,
        commands_executed: 4,
        discord_commands: 2,
        telegram_commands: 1,
        api_commands: 1,
      },
      name
    );
    const u = await m.usage({ days: 7 });
    assert.equal(u.days, 7, name);
    assert.deepEqual(
      Object.keys(u.commands),
      ["prices", "compare"],
      `${name}: sorted by total`
    );
    assert.deepEqual(
      u.commands.prices,
      { total: 3, ok: 3, failed: 0, byPlatform: { discord: 2, telegram: 1 } },
      name
    );
    assert.deepEqual(
      u.commands.compare,
      { total: 1, ok: 0, failed: 1, byPlatform: { api: 1 } },
      name
    );
  }
});
