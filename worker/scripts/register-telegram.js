#!/usr/bin/env node
/**
 * Point the Telegram bot at the Worker webhook (replaces long polling).
 *   TELEGRAM_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... node scripts/register-telegram.js https://bot.chips.gg
 *   TELEGRAM_TOKEN=... node scripts/register-telegram.js --info      (show current webhook)
 *   TELEGRAM_TOKEN=... node scripts/register-telegram.js --delete    (back to polling; Replit fallback)
 * Also publishes the command list so Telegram shows the "/" menu.
 */
import { commands } from "../src/commands/index.js";

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error("set TELEGRAM_TOKEN");
  process.exit(1);
}
const api = async (method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.json();
};

const argv = process.argv.slice(2);
if (argv.includes("--info")) {
  console.log(JSON.stringify(await api("getWebhookInfo"), null, 2));
  process.exit(0);
}
if (argv.includes("--delete")) {
  console.log(
    JSON.stringify(await api("deleteWebhook", { drop_pending_updates: true }))
  );
  process.exit(0);
}
const base = argv.find((a) => a.startsWith("http"));
if (!base) {
  console.error("usage: register-telegram.js https://<worker-host>");
  process.exit(1);
}
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!secret) {
  console.error(
    "set TELEGRAM_WEBHOOK_SECRET (same value as the Worker secret)"
  );
  process.exit(1);
}
const wh = await api("setWebhook", {
  url: `${base.replace(/\/$/, "")}/telegram`,
  secret_token: secret,
  allowed_updates: ["message"],
  drop_pending_updates: true,
  max_connections: 40,
});
console.log("setWebhook:", JSON.stringify(wh));
const menu = await api("setMyCommands", {
  commands: Object.values(commands)
    .filter((c) => !c.staffOnly)
    .map((c) => ({
      command: c.name,
      description: c.description.slice(0, 256),
    })),
});
console.log("setMyCommands:", JSON.stringify(menu));
process.exit(wh.ok && menu.ok ? 0 : 1);
