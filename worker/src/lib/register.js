/**
 * Platform registration done by the Worker itself, with its own secrets, so no bot token ever
 * has to leave Cloudflare (scripts/register-*.js need the token on the machine running them).
 *   POST /admin/register      -> registerPlatforms(env)  (x-admin-secret guarded, in app.js)
 *   cron "17 4 * * *"         -> healTelegram(env)       (puts button taps back if they were lost)
 */
import { commands, discordCommandPayload } from "../commands/index.js";
import { registerCommands } from "../platform/discord-rest.js";
import { tgApi } from "../platform/telegram.js";

// callback_query = support CSAT taps + broadcast-card buttons; same list as scripts/register-telegram.js
export const TELEGRAM_UPDATES = ["message", "callback_query"];

// Telegram omits allowed_updates when none were set, which means "all types" -> taps arrive.
export const hasTaps = (info) =>
  !info?.allowed_updates?.length ||
  info.allowed_updates.includes("callback_query");

export async function registerPlatforms(env) {
  const out = {};
  if (env.TELEGRAM_TOKEN && env.TELEGRAM_WEBHOOK_SECRET && env.PUBLIC_HOST) {
    const tg = tgApi(env);
    out.webhook = (
      await tg("setWebhook", {
        url: `https://${env.PUBLIC_HOST}/telegram`,
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: TELEGRAM_UPDATES,
        max_connections: 40, // pending updates are kept (no drop_pending_updates)
      })
    ).ok;
    out.commands = (
      await tg("setMyCommands", {
        commands: Object.values(commands)
          .filter((c) => !c.staffOnly)
          .map((c) => ({
            command: c.name,
            description: c.description.slice(0, 256),
          })),
      })
    ).ok;
    if (env.COMPANION_URL)
      out.menu = (
        await tg("setChatMenuButton", {
          menu_button: {
            type: "web_app",
            text: "Support",
            web_app: { url: env.COMPANION_URL },
          },
        })
      ).ok;
  }
  if (env.DISCORD_TOKEN && env.DISCORD_APPLICATION_ID)
    out.discord = (await registerCommands(env, discordCommandPayload())).ok;
  return out;
}

// Only when the webhook already points at THIS host: a webhook moved elsewhere on purpose
// (the Node fallback) is left alone.
export async function healTelegram(env) {
  if (!env.TELEGRAM_TOKEN || !env.PUBLIC_HOST) return "skip";
  const info = (await tgApi(env)("getWebhookInfo", {})).result;
  if (info?.url !== `https://${env.PUBLIC_HOST}/telegram`) return "elsewhere";
  if (hasTaps(info)) return "ok";
  console.warn("[register] webhook lost callback_query, re-registering");
  return (await registerPlatforms(env)).webhook ? "healed" : "failed";
}
