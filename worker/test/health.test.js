import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHealth } from "../src/lib/health.js";

// Stub global fetch to answer Telegram + Discord API shapes
const withFetch = async (routes, fn) => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    if (!key) throw new Error(`unexpected fetch ${url}`);
    return { json: async () => routes[key] };
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = orig;
  }
};

const feed = (status) => ({ status: async () => status });
const env = {
  TELEGRAM_TOKEN: "t",
  DISCORD_TOKEN: "d",
  ENVIRONMENT: "dev",
  VERSION: "x",
};
const host = "bot-cf.chips.gg";

test("health: everything wired -> ok, no problems, activity surfaced", async () => {
  const now = Date.now();
  const h = await withFetch(
    {
      getMe: { ok: true, result: { username: "chipsgg_dev_bot" } },
      getWebhookInfo: {
        ok: true,
        result: { url: `https://${host}/telegram`, pending_update_count: 0 },
      },
      "applications/@me": {
        id: "1",
        name: "devbot",
        interactions_endpoint_url: `https://${host}/discord`,
      },
      "users/@me/guilds": [{ id: "g1" }, { id: "g2" }],
    },
    () =>
      buildHealth({
        env,
        host,
        fresh: true,
        feed: feed({
          connected: true,
          stale: false,
          activity: {
            telegram: now - 5000,
            telegram_count: 3,
            discord: now - 60000,
            discord_count: 7,
          },
        }),
      })
  );
  assert.equal(h.ok, true);
  assert.equal(h.status, "healthy");
  assert.deepEqual(h.problems, []);
  assert.equal(h.telegram.bot, "@chipsgg_dev_bot");
  assert.equal(h.telegram.wired, true);
  assert.equal(h.telegram.handled, 3);
  assert.ok(h.telegram.lastSeenAgoSec >= 4 && h.telegram.lastSeenAgoSec <= 6);
  assert.equal(h.discord.app, "devbot");
  assert.equal(h.discord.guilds, 2);
  assert.equal(h.discord.handled, 7);
  assert.equal("activity" in h.feed, false);
});

test("health: webhook pointing elsewhere + telegram delivery error -> 503 with reasons", async () => {
  const h = await withFetch(
    {
      getMe: { ok: true, result: { username: "chipsgg_dev_bot" } },
      getWebhookInfo: {
        ok: true,
        result: {
          url: "https://old-replit.example/telegram",
          pending_update_count: 9,
          last_error_message: "Wrong response from the webhook: 502",
          last_error_date: 1700000000,
        },
      },
      "applications/@me": {
        id: "1",
        name: "devbot",
        interactions_endpoint_url: null,
      },
      "users/@me/guilds": [],
    },
    () =>
      buildHealth({
        env,
        host,
        fresh: true,
        feed: feed({ connected: true, stale: false, activity: {} }),
      })
  );
  assert.equal(h.ok, false);
  assert.equal(h.status, "degraded");
  assert.equal(h.telegram.wired, false);
  assert.equal(h.telegram.pending, 9);
  assert.equal(h.telegram.lastError.at, 1700000000000);
  assert.equal(h.discord.wired, false);
  assert.equal(h.problems.length, 3);
  assert.match(
    h.problems.join("\n"),
    /telegram: webhook is https:\/\/old-replit/
  );
  assert.match(
    h.problems.join("\n"),
    /discord: interactions endpoint is unset/
  );
});

test("health: unconfigured platform is not a failure; stale feed is", async () => {
  const h = await withFetch({}, () =>
    buildHealth({
      env: { ENVIRONMENT: "dev" },
      host,
      fresh: true,
      feed: feed({ connected: true, stale: true, activity: {} }),
    })
  );
  assert.equal(h.telegram.configured, false);
  assert.equal(h.discord.configured, false);
  assert.equal(h.ok, false);
  assert.deepEqual(h.problems, ["feed: no pushes for >5 min"]);
});
