import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SEEN_CAP,
  THUMB_BASE,
  bigWinForm,
  broadcastConfig,
  detectBigWins,
  detectPromotions,
  isBroadcastEnabled,
  promoForm,
  resolveGameImage,
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

test("broadcast config: kinds have separate targets", () => {
  const env = {
    BROADCAST_DISCORD_CHANNELS: "111",
    PROMO_DISCORD_CHANNELS: "",
    PROMO_TELEGRAM_CHATS: "-5",
  };
  const bw = broadcastConfig(env, "bigwin");
  const pr = broadcastConfig(env, "promotion");
  assert.deepEqual([bw.discordChannels, bw.telegramChats], [["111"], []]);
  assert.deepEqual([pr.discordChannels, pr.telegramChats], [[], ["-5"]]);
  assert.equal(
    isBroadcastEnabled(
      broadcastConfig({ BROADCAST_DISCORD_CHANNELS: "1" }, "promotion")
    ),
    false,
    "promo off unless its own list is set"
  );
});

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

test("bigWinForm: gold receipt card with author, thumbnail, fields, two buttons", () => {
  const f = bigWinForm({
    username: "carol",
    avatar: "http://img.example/a.jpg",
    rank: "Collector IV",
    game: "Gates of Olympus",
    gameSlug: "pragmatic-gates",
    gameImage: "https://cdn.hub88.io/pragmatic/gates.jpg",
    provider: "pragmaticplay",
    currency: "eth",
    amountUsd: 12.5,
    winningsUsd: 12_000,
    multiplier: 960,
    at: 1_700_000_000_000,
  });
  assert.equal(f.plainTitle, true);
  assert.equal(f.title, "960x on Gates of Olympus");
  assert.match(
    f.content,
    /\*\*carol\*\* just hit \*\*\$12,000\.00\*\* on Pragmatic Play\./
  );
  assert.equal(f.color, 0xf9c334, "gold: it is money");
  assert.equal(f.author.name, "carol");
  assert.equal(f.author.url, "https://chips.gg/user/carol");
  assert.equal(f.thumbnail, "https://cdn.hub88.io/pragmatic/gates.jpg");
  assert.deepEqual(
    f.fields.map((x) => [x.name, x.value]),
    [
      ["Bet", "$12.50"],
      ["Win", "$12,000.00"],
      ["Multiplier", "960x"],
    ]
  );
  assert.equal(f.footer, "Collector IV  ·  ETH");
  assert.equal(f.timestamp, 1_700_000_000_000);
  assert.equal(f.url, "https://chips.gg/play/pragmatic-gates");
  assert.deepEqual(f.buttons, [
    { label: "Player", url: "https://chips.gg/user/carol" },
  ]);
  assert.doesNotMatch(
    JSON.stringify(f),
    /—/,
    "no em-dashes on a player surface"
  );
  // telegram override: one receipt line, link on the name, no stacked fields
  assert.deepEqual(f.telegram.fields, []);
  assert.match(
    f.telegram.content,
    /\[carol\]\(https:\/\/chips\.gg\/user\/carol\) hit \*\*\$12,000\.00\*\* on Pragmatic Play/
  );
  assert.match(f.telegram.content, /\$12\.50 → \*\*\$12,000\.00\*\* · 960x/);
  assert.equal(f.telegram.footer, "Collector IV · ETH");
});

test("detect carries avatar/game image through and upgrades http to https", () => {
  const cfg = broadcastConfig({ BROADCAST_DISCORD_CHANNELS: "1" });
  const r = row("x", { usd: 5_000 });
  r.player.avatar = "http://pics.example/me.jpg";
  r.game.images = {
    s1: "http://cdn.hub88.io/g/s1.jpg",
    s2: "http://cdn.hub88.io/g/s2.jpg",
  };
  r.game.provider = "hacksaw";
  r.vip = { rank: "Flipper II" };
  const { events } = detectBigWins({ x: r }, cur, new Set(["seed"]), cfg);
  assert.equal(events[0].avatar, "https://pics.example/me.jpg");
  assert.equal(
    events[0].gameImage,
    "https://cdn.hub88.io/g/s2.jpg",
    "prefers s2"
  );
  assert.equal(events[0].provider, "hacksaw");
  assert.equal(events[0].rank, "Flipper II");
  assert.equal(events[0].currency, "eth");
});
test("promotions: cold start records silently; then started/ended diffs", () => {
  const a = { promotionid: "A", title: "Race A", endTime: 1_800_000_000_000 };
  const b = {
    promotionid: "B",
    title: "Race B",
    subtitle: "Win big",
    endTime: 1_800_000_000_000,
  };
  const cold = detectPromotions([a], null);
  assert.deepEqual(cold.started, []);
  assert.deepEqual(cold.known, ["A"]);
  const next = detectPromotions([a, b], cold.known);
  assert.deepEqual(
    next.started.map((p) => p.promotionid),
    ["B"]
  );
  assert.deepEqual(next.ended, []);
  const later = detectPromotions([b], next.known);
  assert.deepEqual(later.started, []);
  assert.deepEqual(later.ended, ["A"]);
  // junk rows ignored; non-array tolerated
  assert.deepEqual(detectPromotions({ not: "array" }, ["A"]).ended, ["A"]);
  assert.deepEqual(detectPromotions([{ title: "no id" }], []).started, []);
  const f = promoForm({
    ...b,
    bannerImage: "http://cdn.redpkt.com/chips/b.webp",
    category: "casino",
    startTime: 1_799_000_000_000,
  });
  assert.equal(f.title, "Race B");
  assert.equal(f.content, "Win big");
  assert.equal(f.color, 0x0065f2, "blue: structure, not money");
  assert.equal(f.banner, "https://cdn.redpkt.com/chips/b.webp");
  assert.deepEqual(
    f.fields.map((x) => x.name),
    ["Starts", "Ends", "Type"]
  );
  assert.equal(f.fields[2].value, "Casino");
  assert.equal(f.url, "https://chips.gg/promotions/B");
});

test("resolveGameImage: custom Chips thumb when the CDN has it, provider art otherwise, cached", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const ok = url.includes("/has-thumb.webp");
    return {
      ok,
      headers: { get: () => (ok ? "image/webp" : "application/xml") },
    };
  };
  const a = await resolveGameImage(
    "has-thumb",
    "https://prov/a.jpg",
    fetchImpl
  );
  assert.equal(a, `${THUMB_BASE}/has-thumb.webp`);
  const b = await resolveGameImage("no-thumb", "https://prov/b.jpg", fetchImpl);
  assert.equal(b, "https://prov/b.jpg", "falls back to provider art");
  await resolveGameImage("has-thumb", "https://prov/a.jpg", fetchImpl);
  await resolveGameImage("no-thumb", "https://prov/b.jpg", fetchImpl);
  assert.equal(calls.length, 2, "second lookups served from cache");
  assert.equal(
    await resolveGameImage(null, "https://prov/c.jpg", fetchImpl),
    "https://prov/c.jpg"
  );
  assert.equal(
    await resolveGameImage("Bad Slug!", null, fetchImpl),
    null,
    "unsafe slug never probed"
  );
});
