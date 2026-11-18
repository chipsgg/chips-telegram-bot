// Support inbox (Chips Desk): Telegram/Discord -> RELAY, relay -> InboxBridge functions.
// Every network edge is a fake: globalThis.fetch (Telegram, Discord, file downloads), RELAY, FILES.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { commands } from "../src/commands/index.js";
import { verifyInitData } from "../src/inbox.js";
import { memoryLinks, resolveLink } from "../src/lib/links.js";
import { discordSend } from "../src/platform/discord-rest.js";
import { handleDiscord } from "../src/platform/discord.js";
import { handleTelegram, telegramSend } from "../src/platform/telegram.js";

// fetch fake: (url, init) -> {status, json} | Response; records every call
function fakeFetch(route) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const body =
      typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    calls.push({ url: u, method: init.method || "GET", body });
    const r = await route(u, body);
    if (r instanceof Response) return r;
    return Response.json(r?.json ?? { ok: true, result: { message_id: 9 } }, {
      status: r?.status ?? 200,
    });
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = orig;
    },
  };
}
const tgMethod = (calls, m) =>
  calls.filter((c) => c.url.endsWith(`/${m}`)).map((c) => c.body);

function fakeRelay(result = { conv: "c1", msg: "m1" }) {
  const calls = { inbound: [], csat: [] };
  return {
    calls,
    inbound: async (p) => (calls.inbound.push(p), result),
    csat: async (p) => (calls.csat.push(p), { ok: true }),
  };
}
const fakeR2 = () => {
  const puts = [];
  return {
    puts,
    put: async (key, body, opts) =>
      puts.push({
        key,
        size: body.byteLength,
        type: opts?.httpMetadata?.contentType,
      }),
  };
};

async function linkedDeps(env, platform, id) {
  const links = memoryLinks();
  if (id) await links.put(platform, id, "U42", "bob");
  const api = {
    auth: async () => {
      throw new Error("no user found"); // a miss; cache is empty for unlinked ids
    },
  };
  return { env, api, links, feed: { mark: async () => undefined } };
}

async function telegram(update, env, deps) {
  const waits = [];
  const req = new Request("https://x/telegram", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": "S" },
    body: JSON.stringify(update),
  });
  const res = await handleTelegram(
    req,
    { TELEGRAM_WEBHOOK_SECRET: "S", ...env },
    deps,
    (p) => waits.push(p)
  );
  await Promise.all(waits);
  return res;
}

const tgMsg = (extra) => ({
  update_id: 777,
  message: {
    message_id: 5,
    from: { id: 1001 },
    chat: { id: 1001, type: "private" },
    ...extra,
  },
});

test("telegram: linked private text -> RELAY.inbound (idem tg:<update_id>) and auto.text sent back", async () => {
  const RELAY = fakeRelay({
    conv: "c",
    msg: "m",
    auto: { text: "We're on it." },
  });
  const env = { TELEGRAM_TOKEN: "T", RELAY };
  const net = fakeFetch(() => null);
  try {
    await telegram(
      tgMsg({ text: "my withdrawal is stuck" }),
      env,
      await linkedDeps(env, "telegram", "1001")
    );
  } finally {
    net.restore();
  }
  assert.deepEqual(RELAY.calls.inbound, [
    {
      channel: "telegram",
      player: "uid:U42",
      name: "bob",
      verified: true,
      text: "my withdrawal is stuck",
      idem: "tg:777",
      platform_id: "1001",
      ext_id: "5",
    },
  ]);
  assert.equal(tgMethod(net.calls, "sendMessage")[0].text, "We're on it.");
});

test("telegram: unlinked player gets the link flow, nothing stored, relay never called", async () => {
  const RELAY = fakeRelay();
  const FILES = fakeR2();
  const env = { TELEGRAM_TOKEN: "T", RELAY, FILES };
  const net = fakeFetch(() => null);
  try {
    await telegram(
      tgMsg({ photo: [{ file_id: "f", file_size: 10 }], caption: "hi" }),
      env,
      await linkedDeps(env, "telegram", null)
    );
  } finally {
    net.restore();
  }
  assert.equal(RELAY.calls.inbound.length, 0);
  assert.equal(FILES.puts.length, 0);
  assert.equal(tgMethod(net.calls, "getFile").length, 0);
  assert.match(
    tgMethod(net.calls, "sendMessage")[0].text,
    /Link your Chips\.gg account/
  );
});

test("telegram: photo -> largest size copied to R2 under tg/, attachment on the inbound", async () => {
  const RELAY = fakeRelay();
  const FILES = fakeR2();
  const env = { TELEGRAM_TOKEN: "T", RELAY, FILES };
  const net = fakeFetch((url) => {
    if (url.endsWith("/getFile"))
      return { json: { ok: true, result: { file_path: "photos/x.jpg" } } };
    if (url === "https://api.telegram.org/file/botT/photos/x.jpg")
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 1]));
  });
  try {
    await telegram(
      tgMsg({
        photo: [
          { file_id: "small", file_size: 1 },
          { file_id: "big", file_size: 4 },
        ],
        caption: "screenshot",
      }),
      env,
      await linkedDeps(env, "telegram", "1001")
    );
  } finally {
    net.restore();
  }
  assert.equal(tgMethod(net.calls, "getFile")[0].file_id, "big");
  assert.deepEqual(FILES.puts, [
    { key: "tg/777/photo.jpg", size: 4, type: "image/jpeg" },
  ]);
  assert.equal(RELAY.calls.inbound[0].text, "screenshot");
  assert.deepEqual(RELAY.calls.inbound[0].attachments, [
    { key: "tg/777/photo.jpg", name: "photo.jpg", type: "image/jpeg", size: 4 },
  ]);
});

test("telegram: oversize document refused before download; relay error -> player told, not silent", async () => {
  const env = { TELEGRAM_TOKEN: "T", RELAY: fakeRelay(), FILES: fakeR2() };
  const net = fakeFetch((url) =>
    url.endsWith("/getFile")
      ? { json: { ok: true, result: { file_path: "d/a.pdf" } } }
      : null
  );
  try {
    const big = {
      file_id: "d",
      file_name: "a.pdf",
      mime_type: "application/pdf",
      file_size: 11 * 1024 * 1024,
    };
    await telegram(
      tgMsg({ document: big }),
      env,
      await linkedDeps(env, "telegram", "1001")
    );
    assert.match(
      tgMethod(net.calls, "sendMessage")[0].text,
      /too big \(max 10 MB\)/
    );
    assert.equal(env.FILES.puts.length, 0);

    env.RELAY = fakeRelay({ error: "inbox unavailable" });
    await telegram(
      tgMsg({ text: "hello" }),
      env,
      await linkedDeps(env, "telegram", "1001")
    );
    assert.match(
      tgMethod(net.calls, "sendMessage")[1].text,
      /didn't reach the team/
    );
  } finally {
    net.restore();
  }
});

test("telegram: commands, groups and no-RELAY keep the old routes (inbox untouched)", async () => {
  const RELAY = fakeRelay();
  const env = { TELEGRAM_TOKEN: "T", RELAY };
  const deps = await linkedDeps(env, "telegram", "1001");
  deps.feed.ratelimit = async () => ({ allowed: true });
  deps.metrics = { track: async () => undefined };
  const net = fakeFetch(() => null);
  try {
    await telegram(
      tgMsg({
        text: "/help",
        entities: [{ type: "bot_command", offset: 0, length: 5 }],
      }),
      env,
      deps
    );
    const group = tgMsg({ text: "hi all" });
    group.message.chat = { id: -5, type: "supergroup" };
    await telegram(group, env, deps);
    await telegram(tgMsg({ text: "hello" }), { TELEGRAM_TOKEN: "T" }, deps);
  } finally {
    net.restore();
  }
  assert.equal(RELAY.calls.inbound.length, 0);
});

test("telegram: CSAT tap -> RELAY.csat, buttons removed, callback answered", async () => {
  const RELAY = fakeRelay();
  const net = fakeFetch(() => null);
  try {
    await telegram(
      {
        update_id: 8,
        callback_query: {
          id: "cq1",
          data: "csat:tok123:4",
          message: { message_id: 50, chat: { id: 1001 } },
        },
      },
      { TELEGRAM_TOKEN: "T", RELAY },
      {}
    );
  } finally {
    net.restore();
  }
  assert.deepEqual(RELAY.calls.csat, [{ token: "tok123", score: 4 }]);
  assert.deepEqual(
    tgMethod(net.calls, "editMessageReplyMarkup")[0].reply_markup,
    {
      inline_keyboard: [],
    }
  );
  assert.deepEqual(tgMethod(net.calls, "answerCallbackQuery")[0], {
    callback_query_id: "cq1",
    text: "Thanks for the rating!",
  });
});

test("telegramSend: label + escaped text + CSAT keyboard; 403 -> 'blocked by user'", async () => {
  let net = fakeFetch(() => ({
    json: { ok: true, result: { message_id: 321 } },
  }));
  try {
    const r = await telegramSend(
      { TELEGRAM_TOKEN: "T" },
      {
        platform: "telegram",
        platform_id: "1001",
        label: "Chips Support · Anna",
        text: "a <b> & c",
        buttons: [{ text: "5", data: "csat:t:5" }],
      }
    );
    assert.deepEqual(r, { ext_id: "321" });
    const sent = tgMethod(net.calls, "sendMessage")[0];
    assert.equal(sent.text, "<b>Chips Support · Anna</b>\na &lt;b&gt; &amp; c");
    assert.deepEqual(sent.reply_markup.inline_keyboard, [
      [{ text: "5", callback_data: "csat:t:5" }],
    ]);
  } finally {
    net.restore();
  }
  net = fakeFetch(() => ({
    status: 403,
    json: {
      ok: false,
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    },
  }));
  try {
    await assert.rejects(
      telegramSend(
        { TELEGRAM_TOKEN: "T" },
        { platform_id: "1", label: "x", text: "y" }
      ),
      /^Error: blocked by user$/
    );
  } finally {
    net.restore();
  }
});

test("discordSend: DM opened, one multipart message with CSAT + Reply rows and the file; 50007 -> 'dms closed'", async () => {
  let net = fakeFetch((url) => {
    if (url.endsWith("/users/@me/channels")) return { json: { id: "DM1" } };
    if (url === "https://relay/signed/a.png")
      return new Response(new Uint8Array([1, 2]));
    if (url.endsWith("/channels/DM1/messages")) return { json: { id: "MSG9" } };
  });
  try {
    const r = await discordSend(
      { DISCORD_TOKEN: "D" },
      {
        platform_id: "555",
        label: "Chips Support · Anna",
        text: "here you go",
        attachments: [
          {
            name: "a.png",
            type: "image/png",
            url: "https://relay/signed/a.png",
          },
        ],
        buttons: [{ text: "5", data: "csat:t:5" }],
      }
    );
    assert.deepEqual(r, { ext_id: "MSG9" });
    const post = net.calls.find((c) =>
      c.url.endsWith("/channels/DM1/messages")
    ).body;
    const payload = JSON.parse(post.get("payload_json"));
    assert.equal(payload.content, "**Chips Support · Anna**\nhere you go");
    assert.deepEqual(
      payload.components.map((row) => row.components.map((b) => b.custom_id)),
      [["csat:t:5"], ["support:reply"]]
    );
    assert.equal((await post.get("files[0]").arrayBuffer()).byteLength, 2);
  } finally {
    net.restore();
  }
  net = fakeFetch(() => ({
    status: 403,
    json: { code: 50007, message: "Cannot send messages to this user" },
  }));
  try {
    await assert.rejects(
      discordSend(
        { DISCORD_TOKEN: "D" },
        { platform_id: "1", label: "x", text: "y" }
      ),
      /^Error: dms closed$/
    );
  } finally {
    net.restore();
  }
});

// Build initData the way Telegram does, with node:crypto (independent of the code under test)
function signInitData(token, fields) {
  const check = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

test("telegram webhook: no secret configured, or a wrong one -> 403, nothing reaches the inbox", async () => {
  const RELAY = fakeRelay();
  for (const [env, hdr] of [
    [{ TELEGRAM_TOKEN: "T", RELAY }, {}],
    [
      { TELEGRAM_TOKEN: "T", RELAY, TELEGRAM_WEBHOOK_SECRET: "S" },
      { "x-telegram-bot-api-secret-token": "nope" },
    ],
  ]) {
    const req = new Request("https://x/telegram", {
      method: "POST",
      headers: hdr,
      body: JSON.stringify(tgMsg({ text: "forged" })),
    });
    const deps = await linkedDeps(env, "telegram", "555");
    assert.equal(
      (await handleTelegram(req, env, deps, () => undefined)).status,
      403
    );
  }
  assert.equal(RELAY.calls.inbound.length, 0);
});

test("verifyInitData: valid -> {platform_id, uid}; tampered, expired and unlinked handled", async () => {
  const now = 1_800_000_000_000;
  const fields = {
    auth_date: String(now / 1000 - 60),
    query_id: "AAH",
    user: JSON.stringify({ id: 1001, first_name: "Bob" }),
  };
  const deps = await linkedDeps(
    { TELEGRAM_TOKEN: "123:ABC" },
    "telegram",
    "1001"
  );
  const good = signInitData("123:ABC", fields);
  assert.deepEqual(await verifyInitData(deps, { init_data: good }, now), {
    platform_id: "1001",
    uid: "U42",
  });
  const tampered = good.replace("Bob", "Eve");
  assert.deepEqual(await verifyInitData(deps, { init_data: tampered }, now), {
    error: "bad signature",
  });
  assert.deepEqual(
    await verifyInitData(
      deps,
      { init_data: signInitData("other:TOKEN", fields) },
      now
    ),
    {
      error: "bad signature",
    }
  );
  const old = signInitData("123:ABC", {
    ...fields,
    auth_date: String(now / 1000 - 90_000),
  });
  assert.deepEqual(await verifyInitData(deps, { init_data: old }, now), {
    error: "expired",
  });
  // a valid but unlinked user: the edge gives them an anon session
  const anon = signInitData("123:ABC", {
    ...fields,
    user: JSON.stringify({ id: 2002 }),
  });
  assert.deepEqual(await verifyInitData(deps, { init_data: anon }, now), {
    platform_id: "2002",
    uid: null,
  });
});

test("resolveLink: hits cached, misses never cached, API calls respect the 1.6 s floor", async () => {
  const sleeps = [];
  let t = 0;
  const clock = { now: () => t, sleep: async (ms) => sleeps.push(ms), next: 0 };
  const lookups = [];
  const api = {
    auth: async (_m, p) => {
      lookups.push(p.platformid);
      if (p.platformid === "1") return { id: "U1", username: "ann" };
      throw new Error("user not found");
    },
  };
  const deps = { api, links: memoryLinks() };
  assert.deepEqual(await resolveLink(deps, "telegram", "1", clock), {
    uid: "U1",
    username: "ann",
  });
  t = 100;
  assert.equal(await resolveLink(deps, "telegram", "2", clock), null);
  assert.deepEqual(sleeps, [1500]); // second API call waited out the floor
  assert.deepEqual(await resolveLink(deps, "telegram", "1", clock), {
    uid: "U1",
    username: "ann",
  });
  assert.equal(await resolveLink(deps, "telegram", "2", clock), null);
  assert.deepEqual(lookups, ["1", "2", "2"]); // the hit came from the cache, the miss did not
});

test("/support: linked -> Reply action; unlinked -> link prompt", async () => {
  const deps = await linkedDeps({}, "discord", "555");
  const run = (userid) =>
    commands.support.handler(
      { platform: "discord", userid, isPrivate: true, sendForm: (f) => f },
      deps
    );
  assert.deepEqual((await run("555")).actions, [
    { label: "Reply", id: "support:reply" },
  ]);
  assert.match((await run("999")).title, /Link your Chips\.gg account/);
});

// Discord: real Ed25519 signatures, like Discord's own
async function discordClient() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    "Ed25519",
    true,
    ["sign", "verify"]
  );
  const pub = Buffer.from(
    await crypto.subtle.exportKey("raw", publicKey)
  ).toString("hex");
  return {
    pub,
    send: async (interaction, env, deps) => {
      const body = JSON.stringify(interaction);
      const ts = "1700000000";
      const sig = Buffer.from(
        await crypto.subtle.sign(
          "Ed25519",
          privateKey,
          new TextEncoder().encode(ts + body)
        )
      ).toString("hex");
      const waits = [];
      const res = await handleDiscord(
        new Request("https://x/discord", {
          method: "POST",
          headers: { "x-signature-ed25519": sig, "x-signature-timestamp": ts },
          body,
        }),
        { ...env, DISCORD_PUBLIC_KEY: pub },
        deps,
        (p) => waits.push(p)
      );
      await Promise.all(waits);
      return res.json();
    },
  };
}

test("discord: Reply button -> modal; submit -> RELAY.inbound (idem dc:<id>) with file in R2 dc/; CSAT -> RELAY.csat", async () => {
  const d = await discordClient();
  const RELAY = fakeRelay({
    conv: "c",
    msg: "m",
    auto: { text: "Back soon." },
  });
  const FILES = fakeR2();
  const env = { RELAY, FILES, DISCORD_APPLICATION_ID: "APP" };
  const deps = await linkedDeps(env, "discord", "555");
  const user = { user: { id: "555" } };
  const net = fakeFetch((url) =>
    url === "https://cdn.discordapp.com/a/shot.png"
      ? new Response(new Uint8Array([1, 2, 3]))
      : { json: {} }
  );
  try {
    const modal = await d.send(
      {
        type: 3,
        id: "i1",
        token: "tk",
        ...user,
        data: { custom_id: "support:reply" },
      },
      env,
      deps
    );
    assert.equal(modal.type, 9);
    assert.equal(modal.data.custom_id, "support:modal");

    const ack = await d.send(
      {
        type: 5,
        id: "i2",
        token: "tk2",
        ...user,
        data: {
          custom_id: "support:modal",
          components: [
            {
              type: 18,
              component: {
                type: 4,
                custom_id: "text",
                value: "deposit missing",
              },
            },
            {
              type: 18,
              component: { type: 19, custom_id: "files", values: ["att1"] },
            },
          ],
          resolved: {
            attachments: {
              att1: {
                filename: "shot.png",
                content_type: "image/png",
                size: 3,
                url: "https://cdn.discordapp.com/a/shot.png",
              },
            },
          },
        },
      },
      env,
      deps
    );
    assert.deepEqual(ack, { type: 5, data: { flags: 64 } });
    assert.deepEqual(FILES.puts, [
      { key: "dc/i2/0/shot.png", size: 3, type: "image/png" },
    ]);
    const inb = RELAY.calls.inbound[0];
    assert.equal(inb.idem, "dc:i2");
    assert.equal(inb.channel, "discord");
    assert.equal(inb.player, "uid:U42");
    assert.equal(inb.platform_id, "555");
    assert.equal(inb.text, "deposit missing");
    assert.equal(inb.attachments[0].key, "dc/i2/0/shot.png");
    const edit = net.calls.find((c) =>
      c.url.endsWith("/webhooks/APP/tk2/messages/@original")
    );
    assert.match(edit.body.content, /Sent to Chips Support[\s\S]*Back soon\./);

    const csat = await d.send(
      {
        type: 3,
        id: "i3",
        token: "tk3",
        ...user,
        data: { custom_id: "csat:tok:5" },
      },
      env,
      deps
    );
    assert.deepEqual(RELAY.calls.csat, [{ token: "tok", score: 5 }]);
    assert.equal(csat.type, 7); // CSAT row dropped, Reply kept
    assert.equal(
      csat.data.components[0].components[0].custom_id,
      "support:reply"
    );
  } finally {
    net.restore();
  }
});

test("discord: unlinked modal submit -> link prompt, nothing stored", async () => {
  const d = await discordClient();
  const RELAY = fakeRelay();
  const FILES = fakeR2();
  const env = { RELAY, FILES, DISCORD_APPLICATION_ID: "APP" };
  const net = fakeFetch(() => ({ json: {} }));
  try {
    await d.send(
      {
        type: 5,
        id: "i9",
        token: "tk9",
        user: { id: "777" },
        data: {
          custom_id: "support:modal",
          components: [
            {
              type: 1,
              components: [{ type: 4, custom_id: "text", value: "hi" }],
            },
          ],
        },
      },
      env,
      await linkedDeps(env, "discord", null)
    );
  } finally {
    net.restore();
  }
  assert.equal(RELAY.calls.inbound.length, 0);
  assert.equal(FILES.puts.length, 0);
  const edit = net.calls.find((c) => c.url.includes("/webhooks/APP/tk9/"));
  assert.match(edit.body.embeds[0].title, /Link your Chips\.gg account/);
  assert.equal(edit.body.flags, 64);
});
