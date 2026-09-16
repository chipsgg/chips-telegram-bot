#!/usr/bin/env node
/**
 * Telegram webhook E2E: POST synthetic Bot-API updates (exactly what Telegram sends) to the
 * Worker with the secret header. Replies are delivered to the real chat_id, so use your own
 * user id (you must have /start-ed the bot once).
 *   TELEGRAM_WEBHOOK_SECRET=... node scripts/e2e_telegram_webhook.js https://bot-cf.chips.gg 147051786 [private|group]
 */
const [base, chatId, chatType = "private"] = process.argv.slice(2);
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!base || !chatId || !secret) {
  console.error(
    "usage: TELEGRAM_WEBHOOK_SECRET=... e2e_telegram_webhook.js <base> <chat_id> [private|group]"
  );
  process.exit(1);
}
// Guard: test tooling never targets production. bot.chips.gg / the prod workers.dev host are refused.
const PROD_HOSTS = ["bot.chips.gg", "chips-bot.chips.workers.dev"];
const refuseProd = (url) => {
  const host = new URL(url).hostname;
  if (PROD_HOSTS.includes(host)) {
    console.error(
      `refusing to run against production host ${host}; use https://bot-cf.chips.gg (dev)`
    );
    process.exit(3);
  }
};
refuseProd(base);
const cmds = process.argv.includes("--all")
  ? [
      "/prices btc",
      "/stats tacyarg",
      "/stats tacyarg 2026-08-01 2026-09-01",
      "/promotions",
      "/search gates of olympus",
      "/bigwins",
      "/luckiest",
      "/slotcall",
      "/koth",
      "/checkaccount",
      "/linkaccount bob 123456",
      "/myaffiliates",
      "/help@chipsgg_dev_bot",
    ]
  : [
      "/prices btc",
      "/stats tacyarg",
      "/checkaccount",
      "/linkaccount bob 123456",
    ];

let id = Math.floor(Date.now() / 1000);
for (const text of cmds) {
  const cmdLen = text.split(" ")[0].length;
  const update = {
    update_id: id++,
    message: {
      message_id: id,
      date: Math.floor(Date.now() / 1000),
      text,
      entities: [{ type: "bot_command", offset: 0, length: cmdLen }],
      from: { id: Number(chatId), is_bot: false, first_name: "e2e" },
      chat:
        chatType === "private"
          ? { id: Number(chatId), type: "private" }
          : { id: Number(chatId), type: "supergroup", title: "e2e" },
    },
  };
  const t0 = Date.now();
  const res = await fetch(`${base}/telegram`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body: JSON.stringify(update),
  });
  console.log(`${res.status} ${Date.now() - t0}ms  ${text}`);
  await new Promise((r) => setTimeout(r, 1500));
}
// wrong secret must be rejected
const bad = await fetch(`${base}/telegram`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-telegram-bot-api-secret-token": "nope",
  },
  body: "{}",
});
console.log(`${bad.status}  (bad secret -> expect 403)`);
