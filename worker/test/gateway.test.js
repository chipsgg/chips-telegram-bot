// Discord plain DMs via the gateway box: discordDm trusts only {channel_id, id} and re-reads the
// message from Discord; /health flags a silent box; the token hand-off seal opens only with its key.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHealth } from "../src/lib/health.js";
import { memoryLinks } from "../src/lib/links.js";
import { newKeyPair, open, seal } from "../src/lib/seal.js";
import { discordDm } from "../src/platform/discord.js";

const CH = "100000000000000001";
const MSG = "200000000000000002";
const USER = "300000000000000003";

function fakeDiscord({ channelType = 1, message = {} } = {}) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method || "GET", body: init.body });
    if (u.endsWith(`/channels/${CH}`))
      return Response.json({ id: CH, type: channelType });
    if (u.endsWith(`/messages/${MSG}`))
      return Response.json({
        id: MSG,
        author: { id: USER, bot: false },
        content: "my withdrawal is stuck",
        attachments: [],
        ...message,
      });
    if (u.endsWith(`/channels/${CH}/messages`))
      return Response.json({ id: "9" });
    throw new Error(`unexpected fetch ${u}`);
  };
  const posts = () =>
    calls.filter((c) => c.method === "POST").map((c) => JSON.parse(c.body));
  return {
    calls,
    posts,
    restore: () => {
      globalThis.fetch = orig;
    },
  };
}

async function setup(linked = true) {
  const inbound = [];
  const env = {
    DISCORD_TOKEN: "D",
    RELAY: {
      inbound: async (p) => (inbound.push(p), { auto: { text: "We got it." } }),
    },
  };
  const links = memoryLinks();
  if (linked) await links.put("discord", USER, "U42", "bob");
  const api = { auth: async () => Promise.reject(new Error("no user found")) };
  return {
    env,
    inbound,
    deps: { env, api, links, feed: { mark: async () => undefined } },
  };
}

test("discordDm: linked DM -> RELAY.inbound (idem dc:<message id>) and the auto-reply in the DM", async () => {
  const { env, inbound, deps } = await setup();
  const net = fakeDiscord();
  try {
    assert.equal(await discordDm(env, deps, { channel_id: CH, id: MSG }), "ok");
  } finally {
    net.restore();
  }
  assert.equal(inbound.length, 1);
  assert.equal(inbound[0].idem, `dc:${MSG}`);
  assert.equal(inbound[0].channel, "discord");
  assert.equal(inbound[0].platform_id, USER);
  assert.equal(inbound[0].text, "my withdrawal is stuck");
  assert.equal(net.posts()[0].embeds[0].description, "We got it.");
});

test("discordDm: unlinked -> link prompt in the DM, relay never called", async () => {
  const { env, inbound, deps } = await setup(false);
  const net = fakeDiscord();
  try {
    await discordDm(env, deps, { channel_id: CH, id: MSG });
  } finally {
    net.restore();
  }
  assert.equal(inbound.length, 0);
  assert.match(JSON.stringify(net.posts()[0]), /Link your Chips\.gg account/);
});

test("discordDm: a forged poke can't make a ticket (guild channel, bot author, bad ids)", async () => {
  const { env, inbound, deps } = await setup();
  for (const [opts, poke, want] of [
    [{ channelType: 0 }, { channel_id: CH, id: MSG }, "not a dm"],
    [
      { message: { author: { id: USER, bot: true } } },
      { channel_id: CH, id: MSG },
      "ignored",
    ],
    [{}, { channel_id: "../users/@me", id: MSG }, "bad ids"],
  ]) {
    const net = fakeDiscord(opts);
    try {
      assert.equal(await discordDm(env, deps, poke), want);
      assert.equal(net.posts().length, 0);
    } finally {
      net.restore();
    }
  }
  assert.equal(inbound.length, 0);
});

test("seal: opens with the box's key only", async () => {
  const box = await newKeyPair();
  const other = await newKeyPair();
  const sealed = await seal(box.pub, "token-value");
  assert.equal(await open(box.priv, sealed), "token-value");
  await assert.rejects(open(other.priv, sealed));
});

test("health: gateway configured -> problem when never seen or silent, fine when fresh", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ json: async () => ({}) });
  const run = (activity) =>
    buildHealth({
      env: { GATEWAY_SECRET: "g" },
      feed: {
        status: async () => ({ connected: true, stale: false, activity }),
      },
      host: "x",
      fresh: true,
    });
  try {
    const never = await run({});
    assert.equal(never.ok, false);
    assert.match(never.problems.join(), /gateway box silent/);
    const stale = await run({ gateway: Date.now() - 6 * 60_000 });
    assert.equal(stale.ok, false);
    const fresh = await run({ gateway: Date.now() - 30_000, gateway_count: 3 });
    assert.equal(fresh.ok, true);
    assert.equal(fresh.discord.gateway.pings, 3);
    const off = await buildHealth({
      env: {},
      feed: {
        status: async () => ({ connected: true, stale: false, activity: {} }),
      },
      host: "x",
      fresh: true,
    });
    assert.equal(off.discord.gateway, undefined);
  } finally {
    globalThis.fetch = orig;
  }
});
