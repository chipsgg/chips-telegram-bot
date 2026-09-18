import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SEEN_CAP,
  bigWinForm,
  broadcastConfig,
  detectBigWins,
  isBroadcastEnabled,
  trimSeen,
} from "../src/lib/broadcast.js";

const cur = {
  eth: { decimals: 18, price: 2500 },
  btc: { decimals: 8, price: 80000 },
};
const row = (
  id,
  {
    usd = 1,
    mult = 2,
    user = "bob",
    game = "Sweet Bonanza",
    currency = "eth",
  } = {}
) => {
  const price = cur[currency].price;
  const dec = cur[currency].decimals;
  const winnings =
    BigInt(Math.round((usd / price) * 10 ** 6)) * BigInt(10) ** BigInt(dec - 6);
  return {
    id,
    userid: `u-${user}`,
    created: 1_700_000_000_000,
    bet: {
      id,
      done: true,
      win: true,
      amount: String(winnings / BigInt(Math.max(1, Math.round(mult)))),
      winnings: String(winnings),
      multiplier: mult,
      currency,
      updated: 1_700_000_000_500,
    },
    player: { username: user },
    game: { title: game, slug: "sb" },
  };
};

test("broadcast config: empty = disabled, lists parsed, defaults applied", () => {
  const off = broadcastConfig({});
  assert.equal(isBroadcastEnabled(off), false);
  assert.equal(off.minUsd, 1000);
  const on = broadcastConfig({
    BROADCAST_DISCORD_CHANNELS: "1, 2",
    BROADCAST_TELEGRAM_CHATS: "-100",
    BROADCAST_MIN_USD: "250",
  });
  assert.equal(isBroadcastEnabled(on), true);
  assert.deepEqual(on.discordChannels, ["1", "2"]);
  assert.deepEqual(on.telegramChats, ["-100"]);
  assert.equal(on.minUsd, 250);
});

test("detect: cold start swallows the current board (no re-announce after deploy)", () => {
  const cfg = broadcastConfig({ BROADCAST_DISCORD_CHANNELS: "1" });
  const rows = { a: row("a", { usd: 50_000 }), b: row("b", { usd: 20_000 }) };
  const r = detectBigWins(rows, cur, new Set(), cfg);
  assert.deepEqual(r.events, []);
  assert.deepEqual([...r.seen].sort(), ["a", "b"]);
});

test("detect: new rows over threshold are announced once, biggest first, capped per flush", () => {
  const cfg = broadcastConfig({
    BROADCAST_DISCORD_CHANNELS: "1",
    BROADCAST_MAX_PER_FLUSH: "2",
  });
  let seen = new Set(["old"]);
  const rows = {
    old: row("old", { usd: 99_999 }),
    small: row("small", { usd: 200, mult: 3 }), // under both thresholds
    lucky: row("lucky", { usd: 300, mult: 800 }), // multiplier qualifies
    big: row("big", { usd: 5_000, user: "alice" }),
    bigger: row("bigger", { usd: 12_000, user: "carol", currency: "btc" }),
  };
  const r = detectBigWins(rows, cur, seen, cfg);
  assert.deepEqual(
    r.events.map((e) => e.betId),
    ["bigger", "big"],
    "sorted by winnings, capped at 2 (lucky dropped by cap, small by threshold)"
  );
  assert.ok(Math.abs(r.events[0].winningsUsd - 12_000) < 1);
  assert.equal(r.events[0].username, "carol");
  seen = r.seen;
  // second pass: nothing new
  assert.deepEqual(detectBigWins(rows, cur, seen, cfg).events, []);
  // all ids now seen, including the ones under threshold
  for (const id of Object.keys(rows)) assert.ok(seen.has(id), id);
});

test("detect: incomplete rows ignored; seen set stays bounded", () => {
  const cfg = broadcastConfig({ BROADCAST_DISCORD_CHANNELS: "1" });
  const rows = {
    nobet: { id: "x", player: { username: "a" } },
    pending: {
      ...row("p", { usd: 9_000 }),
      bet: { ...row("p").bet, done: false },
    },
    ok: row("ok", { usd: 9_000 }),
  };
  const r = detectBigWins(rows, cur, new Set(["seed"]), cfg);
  assert.deepEqual(
    r.events.map((e) => e.betId),
    ["ok"]
  );
  const big = new Set(
    Array.from({ length: SEEN_CAP + 50 }, (_, i) => `id${i}`)
  );
  const trimmed = trimSeen(big);
  assert.equal(trimmed.size, SEEN_CAP);
  assert.ok(trimmed.has(`id${SEEN_CAP + 49}`), "newest kept");
  assert.ok(!trimmed.has("id0"), "oldest dropped");
});

test("bigWinForm renders amounts, multiplier, links", () => {
  const f = bigWinForm({
    username: "carol",
    game: "Gates of Olympus",
    gameSlug: "pragmatic-gates",
    amountUsd: 12.5,
    winningsUsd: 12_000,
    multiplier: 960,
  });
  assert.equal(f.title, "Big Win");
  assert.match(
    f.content,
    /\*\*carol\*\* just turned \$12\.50 into \*\*\$12,000\.00\*\* \(960x\) on Gates of Olympus\./
  );
  assert.equal(f.url, "https://chips.gg/play/pragmatic-gates");
  assert.equal(f.links.player, "https://chips.gg/user/carol");
});
