import assert from "node:assert/strict";
import { test } from "node:test";
import * as affiliate from "../src/commands/affiliate.js";
import { commands, discordCommandPayload } from "../src/commands/index.js";
import {
  changelogLines,
  changelogSummary,
  fetchChangelog,
  parseAtom,
} from "../src/lib/changelog.js";
import {
  discordMakeForm,
  discordRoleForRank,
} from "../src/platform/discord-rest.js";
import { verifyDiscordRequest } from "../src/platform/discord.js";
import {
  mdToTelegramHtml,
  telegramMakeForm,
} from "../src/platform/telegram.js";

// Minimal ctx that records the last form/text
const ctx = (platform, args = {}, extra = {}) => {
  let out = null;
  return {
    platform,
    userid: "u1",
    isPrivate: true,
    getString: (name, index) => args[name] ?? args[index],
    rest: () => args.rest || "",
    sendForm: (f) => {
      out = f;
      return f;
    },
    sendText: (t) => {
      out = { text: t };
      return out;
    },
    result: () => out,
    ...extra,
  };
};

// Fake feed: returns canned state; fake api: routes channel/method -> canned data
const feed = (state) => ({
  get: async (...paths) => ({
    updatedAt: Date.now(),
    stale: false,
    data: Object.fromEntries(paths.map((p) => [p, state[p]])),
  }),
});
const api = (routes) => {
  const ch = (c) => async (m, p) => {
    const fn = routes[`${c}/${m}`];
    if (!fn) throw new Error(`no route ${c}/${m}`);
    return fn(p);
  };
  return {
    public: ch("public"),
    auth: ch("auth"),
    backoffice: ch("backoffice"),
    hasToken: true,
  };
};

test("registry: 19 commands, identity ones flagged, discord payload valid", () => {
  assert.equal(Object.keys(commands).length, 19);
  for (const n of ["linkaccount", "checkaccount", "myaffiliates", "affiliate"])
    assert.equal(commands[n].identity, true, n);
  assert.equal(commands.affiliate.staffOnly, true);
  const payload = discordCommandPayload();
  assert.equal(payload.length, 19);
  for (const c of payload) {
    assert.match(c.name, /^[a-z]{1,32}$/);
    assert.ok(c.description.length <= 100);
    for (const o of c.options || [])
      assert.ok([3, 10].includes(o.type), `${c.name}.${o.name} type`);
  }
  const totp = payload
    .find((c) => c.name === "linkaccount")
    .options.find((o) => o.name === "totp");
  assert.equal(totp.type, 3, "totp must be STRING (leading zeros)");
});

test("/prices from feed state, filter + unknown", async () => {
  const cur = {
    btc: { name: "btc", price: 76086.01, decimals: 8 },
    usdt: { name: "usdt", price: 1 },
    chips: { name: "chips", price: 0.01 },
    trx: { name: "trx", price: 0.3369, hidden: false },
  };
  const c = ctx("api");
  await commands.prices.handler(c, {
    feed: feed({ "public.currencies": cur }),
  });
  assert.equal(c.result().content, "BTC/USD: $76,086.01\nTRX/USD: $0.3369");
  const c2 = ctx("api", { currency: "btc" });
  await commands.prices.handler(c2, {
    feed: feed({ "public.currencies": cur }),
  });
  assert.equal(c2.result().content, "BTC/USD: $76,086.01");
  const c3 = ctx("api", { currency: "nope" });
  await commands.prices.handler(c3, {
    feed: feed({ "public.currencies": cur }),
  });
  assert.match(c3.result().text, /not found/);
});

test("/bigwins: usd conversion, one row per player, sorted by winnings", async () => {
  const cur = {
    sol: { name: "sol", price: 100, decimals: 9 },
    usdt: { name: "usdt", price: 1, decimals: 6 },
  };
  const rows = {
    a: {
      userid: "p1",
      player: { username: "alice" },
      game: { title: "G1", slug: "g1" },
      bet: { amount: 1e9, winnings: 5e9, currency: "sol", multiplier: 5 },
    }, // $100 -> $500
    b: {
      userid: "p2",
      player: { username: "bob" },
      game: { title: "G2", slug: "g2" },
      bet: {
        amount: 9e6,
        winnings: 12103.8e6,
        currency: "usdt",
        multiplier: 1344.87,
      },
    }, // $9 -> $12,103.80
    c: {
      userid: "p1",
      player: { username: "alice" },
      game: { title: "G3", slug: "g3" },
      bet: { amount: 1e9, winnings: 2e9, currency: "sol", multiplier: 2 },
    }, // dup player
    d: { userid: "p3", player: { username: "empty" }, bet: {} },
  };
  const c = ctx("telegram");
  await commands.bigwins.handler(c, {
    feed: feed({ "stats.bets.bigwins": rows, "public.currencies": cur }),
  });
  const lines = c
    .result()
    .content.split("\n")
    .filter((l) => /^\d\./.test(l));
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^1\. \$9\.00 ➜ \*\*\$12,103\.80\*\* \(1,344\.87x\)/);
  assert.match(lines[1], /^2\. \$100\.00 ➜ \*\*\$500\.00\*\* \(5x\)/);
});

test("/stats: uses getUserStats window, labels default as last 30 days", async () => {
  const calls = [];
  const a = api({
    "public/getPlayer": async (p) =>
      p.userid === "tacyarg"
        ? {
            id: "uid",
            username: "tacyarg",
            created: Date.UTC(2020, 6, 7),
            vip: { rank: "Collector III", level: 166 },
          }
        : null,
    "public/getUserStats": async (p) => {
      calls.push(p);
      return { count: 10, wageredUsd: 1000, bonusesUsd: 5, pnlUsd: -20 };
    },
  });
  const c = ctx("api", { username: "tacyarg" });
  await commands.stats.handler(c, { api: a });
  assert.deepEqual(calls[0], { userid: "uid", duration: "1m" });
  assert.match(c.result().content, /\*\*Period:\*\* last 30 days/);
  assert.match(c.result().content, /\*\*PnL:\*\* -\$20\.00/);
  assert.match(c.result().content, /\*\*Joined:\*\* 2020-07-07/);
  const c2 = ctx("api", {
    username: "tacyarg",
    start: "2026-08-01",
    end: "2026-09-01",
  });
  await commands.stats.handler(c2, { api: a });
  assert.equal(calls[1].start, Date.UTC(2026, 7, 1));
  assert.match(c2.result().content, /2026-08-01 — 2026-09-01/);
  const c3 = ctx("api", { username: "ghost" });
  await commands.stats.handler(c3, { api: a });
  assert.match(c3.result().text, /not found/);
});

test("/promotions: {} params, sorted, linked, summarised", async () => {
  let params;
  const now = Date.now();
  const a = api({
    "public/listRunningPromotions": async (p) => {
      params = p;
      return [
        {
          promotionid: "10kraff",
          title: "$10,000 Weekly Raffle",
          endTime: now + 2 * 86400000,
          description: "## Rules\n\nEvery $10 wagered = 1 ticket.",
        },
        {
          promotionid: "2kbtb",
          title: "Beat The Boss",
          endTime: now + 3600000,
          subtitle: "Hit 500x",
        },
      ];
    },
  });
  const c = ctx("telegram");
  await commands.promotions.handler(c, { api: a });
  assert.deepEqual(params, {});
  const content = c.result().content;
  assert.ok(
    content.indexOf("Beat The Boss") < content.indexOf("Weekly Raffle")
  );
  assert.match(
    content,
    /\[\$10,000 Weekly Raffle\]\(https:\/\/chips\.gg\/promotions\/10kraff\)/
  );
  assert.match(content, /Every \$10 wagered = 1 ticket\./);
});

test("/linkaccount: refuses in telegram groups, validates code, never logs it", async () => {
  const deleted = [];
  const c = ctx(
    "telegram",
    {},
    { isPrivate: false, deleteMessage: async () => deleted.push(1) }
  );
  await commands.linkaccount.handler(c, { api: api({}), env: {} });
  assert.equal(deleted.length, 1);
  assert.match(c.result().text, /private chat/);
  const c2 = ctx("telegram", { 1: "bob", 2: "12345" });
  await commands.linkaccount.handler(c2, { api: api({}), env: {} });
  assert.match(c2.result().text, /6-digit/);
  const logs = [];
  const orig = console.info;
  console.info = (...a) => logs.push(JSON.stringify(a));
  try {
    const a = api({
      "auth/linkPlatformID": async () => ({ userid: "uid" }),
      "public/getPlayer": async () => ({
        username: "bob",
        vip: { rank: "Flipper" },
      }),
    });
    const c3 = ctx("telegram", { 1: "bob", 2: "012345" });
    await commands.linkaccount.handler(c3, { api: a, env: {} });
    assert.match(c3.result().content, /linked to \*\*bob\*\*/);
  } finally {
    console.info = orig;
  }
  assert.ok(logs.length > 0);
  assert.ok(
    logs.every((l) => !l.includes("012345")),
    "TOTP leaked to logs"
  );
});

test("/linkaccount: assigns a Discord role only in DISCORD_ROLES_GUILD_ID", async () => {
  // The role PUT goes to fetch(); capture whether it was attempted
  const puts = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    puts.push(`${init?.method} ${url}`);
    return { ok: true, status: 204, text: async () => "" };
  };
  const a = api({
    "auth/linkPlatformID": async () => ({ userid: "uid" }),
    "public/getPlayer": async () => ({
      username: "bob",
      vip: { rank: "Flipper I" },
    }),
  });
  const env = {
    DISCORD_TOKEN: "t",
    DISCORD_ROLES_GUILD_ID: "541035273547415552",
  };
  try {
    // foreign guild: no PUT, no "role updated" line
    const foreign = ctx(
      "discord",
      { username: "bob", totp: "012345" },
      { guildId: "999" }
    );
    await commands.linkaccount.handler(foreign, { api: a, env });
    assert.equal(
      puts.length,
      0,
      "must not touch roles outside the Chips guild"
    );
    assert.doesNotMatch(foreign.result().content, /role updated/i);

    // the Chips guild: exactly one PUT to the flipper role
    const home = ctx(
      "discord",
      { username: "bob", totp: "012345" },
      { guildId: "541035273547415552" }
    );
    await commands.linkaccount.handler(home, { api: a, env });
    assert.equal(puts.length, 1);
    assert.match(
      puts[0],
      /^PUT .*\/guilds\/541035273547415552\/members\/u1\/roles\/1106398232382291978$/
    );
    assert.match(home.result().content, /role updated/i);

    // unset env: never assigns
    const noenv = ctx(
      "discord",
      { username: "bob", totp: "012345" },
      { guildId: "541035273547415552" }
    );
    await commands.linkaccount.handler(noenv, {
      api: a,
      env: { DISCORD_TOKEN: "t" },
    });
    assert.equal(puts.length, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("/affiliate: staff gate via isAdmin or backoffice role", async () => {
  const a = api({
    "auth/getUserByPlatformID": async (p) =>
      p.platformid === "staff"
        ? { id: "s", username: "staff", isAdmin: false }
        : p.platformid === "pleb"
          ? { id: "p", username: "pleb" }
          : null,
    "backoffice/getUser": async (p) => ({
      roles: p.userid === "s" ? ["backoffice"] : [],
    }),
    "public/getPlayer": async () => ({ id: "t", username: "sousa" }),
    "backoffice/listCampaignsByUser": async () => [
      {
        signups: 3,
        stats: {
          wageredUsd: 1000,
          commissionUsd: 1,
          bonusUsd: 9,
          profitUsd: -35,
        },
      },
    ],
    "backoffice/listReferralsByUser": async () => [],
  });
  const staff = ctx("discord", { username: "sousa" }, { userid: "staff" });
  await commands.affiliate.handler(staff, { api: a });
  assert.match(staff.result().content, /Code profit \(house\): \$35\.00/);
  const pleb = ctx("discord", { username: "sousa" }, { userid: "pleb" });
  await commands.affiliate.handler(pleb, { api: a });
  assert.match(pleb.result().text, /not authorized/);
  const unlinked = ctx("discord", { username: "sousa" }, { userid: "nobody" });
  await commands.affiliate.handler(unlinked, { api: a });
  assert.match(unlinked.result().text, /linkaccount/);
});

test("affiliate.aggregate + render staff vs player", () => {
  const t = affiliate.aggregate([
    {
      signups: 10,
      stats: {
        ftd: 3,
        bets: 500,
        depositUsd: 1000,
        wageredUsd: 20000,
        commissionUsd: 20,
        bonusUsd: 180,
        profitUsd: -700,
      },
    },
    { done: true, signups: 5, stats: null },
  ]);
  assert.equal(t.signups, 15);
  assert.equal(t.active, 1);
  assert.equal(t.codeProfitUsd, 700);
  const base = {
    user: { username: "x" },
    period: { startLabel: "a", endLabel: "b" },
    totals: t,
    referrals: [
      { user: { username: "whale" }, wageredUsd: 15000, depositUsd: 800 },
    ],
  };
  assert.doesNotMatch(
    affiliate.render({ ...base, staff: false }),
    /Code profit/
  );
  assert.match(
    affiliate.render({ ...base, staff: true }),
    /Bonuses handed to referrals: \$180\.00/
  );
});

test("discord form: embed, link button, reroll button, ephemeral flag", () => {
  const p = discordMakeForm({
    emoji: "🎰",
    title: "T",
    content: "c",
    url: "https://chips.gg/x",
    buttonLabel: "Play",
    reroll: "slotcall",
  });
  assert.equal(p.embeds[0].title, "🎰 T 🎰");
  assert.equal(p.components[0].components.length, 2);
  assert.equal(p.components[0].components[1].custom_id, "reroll:slotcall");
  assert.equal(discordMakeForm({ title: "x", ephemeral: true }).flags & 64, 64);
  assert.equal(discordRoleForRank("Collector III"), "1106398500020834405");
  assert.equal(discordRoleForRank("Unranked"), null);
});

test("discord form: rich fields (color, author, thumbnail, fields, timestamp, extra buttons, plain title)", () => {
  const p = discordMakeForm({
    plainTitle: true,
    title: "960x on Gates",
    content: "c",
    color: 0xf9c334,
    author: {
      name: "carol",
      url: "https://chips.gg/user/carol",
      icon_url: "https://a/b.png",
    },
    thumbnail: "https://t/x.jpg",
    fields: [{ name: "Bet", value: "$1", inline: true }],
    timestamp: 1_700_000_000_000,
    url: "https://chips.gg/play/g",
    buttonLabel: "Play it",
    buttons: [{ label: "Player", url: "https://chips.gg/user/carol" }],
  });
  const e = p.embeds[0];
  assert.equal(e.title, "960x on Gates", "no emoji wrap");
  assert.equal(e.color, 0xf9c334);
  assert.equal(e.author.name, "carol");
  assert.equal(e.thumbnail.url, "https://t/x.jpg");
  assert.deepEqual(e.fields, [{ name: "Bet", value: "$1", inline: true }]);
  assert.equal(e.timestamp, "2023-11-14T22:13:20.000Z");
  assert.deepEqual(
    p.components[0].components.map((b) => [b.label, b.url]),
    [
      ["Play it", "https://chips.gg/play/g"],
      ["Player", "https://chips.gg/user/carol"],
    ]
  );
});

test("telegram form: `telegram` override block wins over embed fields", () => {
  const html = telegramMakeForm({
    plainTitle: true,
    title: "T",
    content: "embed body",
    fields: [{ name: "Bet", value: "$1" }],
    footer: "embed footer",
    telegram: { content: "phone body", fields: [], footer: undefined },
  });
  assert.equal(html, "<b>T</b>\nphone body");
});

test("telegram html: bold/link/escape, form layout", () => {
  assert.equal(
    mdToTelegramHtml("**b** & [l](https://x.y/z?a=1&b=2) <t>"),
    '<b>b</b> &amp; <a href="https://x.y/z?a=1&amp;b=2">l</a> &lt;t&gt;'
  );
  assert.equal(mdToTelegramHtml("-# sub"), "sub");
  const f = telegramMakeForm({
    emoji: "📊",
    title: "A<B",
    content: "line1\n**x**",
    footer: "f",
  });
  assert.equal(f, "📊 <b>A&lt;B</b> 📊\nline1\n<b>x</b>\n\nf");
});

test("discord signature verify (real Ed25519 round-trip)", async () => {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    "Ed25519",
    true,
    ["sign", "verify"]
  );
  const pubHex = Buffer.from(
    await crypto.subtle.exportKey("raw", publicKey)
  ).toString("hex");
  const body = JSON.stringify({ type: 1 });
  const ts = "1700000000";
  const sig = Buffer.from(
    await crypto.subtle.sign(
      "Ed25519",
      privateKey,
      new TextEncoder().encode(ts + body)
    )
  ).toString("hex");
  const req = (s) =>
    new Request("https://x/discord", {
      method: "POST",
      headers: { "x-signature-ed25519": s, "x-signature-timestamp": ts },
    });
  assert.equal(await verifyDiscordRequest(req(sig), pubHex, body), true);
  assert.equal(await verifyDiscordRequest(req(sig), pubHex, body + " "), false);
  assert.equal(
    await verifyDiscordRequest(req("00" + sig.slice(2)), pubHex, body),
    false
  );
});

test("changelogLines: GitHub generated notes -> {text, pr}, headings/footer dropped", () => {
  const body = [
    "## What's Changed",
    "* v4.2: broadcasts, promo push by @tacyarg in https://github.com/chipsgg/chips-telegram-bot/pull/112",
    "- Plain bullet with no PR",
    "* Bump send and express by @dependabot[bot] in https://github.com/chipsgg/chips-telegram-bot/pull/62",
    "* chore(deps): update dependency ws by @renovate[bot] in https://github.com/x/y/pull/9",
    "",
    "**Full Changelog**: https://github.com/chipsgg/chips-telegram-bot/compare/v4.1.0...v4.2.0",
  ].join("\n");
  assert.deepEqual(changelogLines(body), [
    {
      text: "v4.2: broadcasts, promo push",
      pr: 112,
      prUrl: "https://github.com/chipsgg/chips-telegram-bot/pull/112",
    },
    { text: "Plain bullet with no PR", pr: null, prUrl: null },
  ]);
});

test("changelogSummary: first prose line under the heading, code ticks stripped, none -> null", () => {
  assert.equal(
    changelogSummary("## Title\n\nThe bot moved to `Workers`.\n\n* a bullet"),
    "The bot moved to Workers."
  );
  assert.equal(
    changelogSummary(
      "## What's Changed\n* only bullets\n\n**Full Changelog**: x"
    ),
    null
  );
});

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Release notes</title>
<entry><id>tag:github.com,2008:Repository/1/v4.2.1</id><updated>2026-09-19T00:25:20Z</updated>
<link rel="alternate" type="text/html" href="https://github.com/chipsgg/chips-telegram-bot/releases/tag/v4.2.1"/>
<title>v4.2.1: changelog on the landing page</title>
<content type="html">&lt;h2&gt;The changelog you are reading&lt;/h2&gt;
&lt;p&gt;Release notes now show up on &lt;code&gt;bot.chips.gg&lt;/code&gt;.&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;Section on the landing page by &lt;a href="https://github.com/tacyarg"&gt;@tacyarg&lt;/a&gt; in &lt;a href="https://github.com/chipsgg/chips-telegram-bot/pull/113"&gt;#113&lt;/a&gt;&lt;/li&gt;
&lt;li&gt;Bump ws by &lt;a href="https://github.com/apps/dependabot"&gt;@dependabot&lt;/a&gt; in &lt;a href="https://github.com/x/y/pull/9"&gt;#9&lt;/a&gt;&lt;/li&gt;
&lt;li&gt;Footer shows the running version&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;&lt;strong&gt;Full Changelog&lt;/strong&gt;: &lt;a href="https://github.com/chipsgg/chips-telegram-bot/compare/v4.2.0...v4.2.1"&gt;v4.2.0...v4.2.1&lt;/a&gt;&lt;/p&gt;</content>
</entry></feed>`;

test("changelog atom fallback: same shape as the API path, PR links kept, bot bumps dropped", () => {
  const [r] = parseAtom(ATOM);
  assert.equal(r.tag, "v4.2.1");
  assert.equal(r.name, "v4.2.1: changelog on the landing page");
  assert.equal(r.date, "2026-09-19T00:25:20Z");
  assert.equal(r.summary, "Release notes now show up on bot.chips.gg.");
  assert.deepEqual(r.notes, [
    {
      text: "Section on the landing page",
      pr: 113,
      prUrl: "https://github.com/chipsgg/chips-telegram-bot/pull/113",
    },
    { text: "Footer shows the running version", pr: null, prUrl: null },
  ]);
});

test("fetchChangelog: API 403 falls through to the atom feed", async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(url);
    if (/api\.github/.test(url))
      return new Response("rate limited", { status: 403 });
    return new Response(ATOM, { status: 200 });
  };
  const rel = await fetchChangelog({ VERSION: "t" }, fake);
  assert.equal(rel.length, 1);
  assert.equal(rel[0].tag, "v4.2.1");
  assert.ok(calls[1].endsWith("/releases.atom"));
});
