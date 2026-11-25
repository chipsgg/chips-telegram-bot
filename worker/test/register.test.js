import assert from "node:assert/strict";
import { test } from "node:test";
import { hasTaps, healTelegram } from "../src/lib/register.js";

test("hasTaps: unset allowed_updates means all types", () => {
  assert.equal(hasTaps({}), true);
  assert.equal(hasTaps({ allowed_updates: [] }), true);
  assert.equal(hasTaps({ allowed_updates: ["message"] }), false);
  assert.equal(
    hasTaps({ allowed_updates: ["message", "callback_query"] }),
    true
  );
});

test("healTelegram: re-registers only a webhook that points here and lost taps", async () => {
  const env = {
    TELEGRAM_TOKEN: "t",
    TELEGRAM_WEBHOOK_SECRET: "s",
    PUBLIC_HOST: "bot.example",
  };
  const orig = globalThis.fetch;
  const run = async (info) => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      const method = String(url).split("/").pop();
      calls.push({ method, body: init?.body && JSON.parse(init.body) });
      const result = method === "getWebhookInfo" ? info : true;
      return { json: async () => ({ ok: true, result }) };
    };
    return [await healTelegram(env), calls];
  };
  try {
    const here = "https://bot.example/telegram";
    assert.equal(
      (
        await run({ url: "https://fallback/x", allowed_updates: ["message"] })
      )[0],
      "elsewhere"
    );
    assert.equal(
      (
        await run({ url: here, allowed_updates: ["message", "callback_query"] })
      )[0],
      "ok"
    );
    const [r, calls] = await run({ url: here, allowed_updates: ["message"] });
    assert.equal(r, "healed");
    const set = calls.find((c) => c.method === "setWebhook").body;
    assert.deepEqual(set.allowed_updates, ["message", "callback_query"]);
    assert.equal(set.secret_token, "s");
    assert.equal(set.drop_pending_updates, undefined);
  } finally {
    globalThis.fetch = orig;
  }
});
