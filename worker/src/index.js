/**
 * Cloudflare Workers entry. All routing lives in ./app.js; this file wires the
 * Cloudflare services: Durable Object feed, D1 metrics, ASSETS for the landing page.
 */
import { WorkerEntrypoint } from "cloudflare:workers";
import { createApp } from "./app.js";
import { feedClient } from "./feed/chips-feed.js";
import { verifyInitData } from "./inbox.js";
import { createApi } from "./lib/chips.js";
import { d1Links } from "./lib/links.js";
import { d1Metrics } from "./lib/metrics.js";
import { d1Registry, runRoleSync } from "./lib/rolesync.js";
import { discordSend } from "./platform/discord-rest.js";
import { telegramNotify, telegramSend } from "./platform/telegram.js";

export { ChipsFeed } from "./feed/chips-feed.js";

export default {
  async fetch(request, env, ctx) {
    const app = createApp({
      env,
      feed: feedClient(env),
      metrics: d1Metrics(env.DB),
      registry: d1Registry(env.DB),
      links: d1Links(env.DB),
    });
    const res = await app(request, (p) => ctx.waitUntil(p));
    return res ?? env.ASSETS.fetch(request);
  },

  // wrangler.toml [triggers] crons:
  //   "* * * * *"   watchdog: probe our own public /health, alert on transitions
  //   "17 4 * * *"  daily VIP rank -> Discord role sync
  async scheduled(event, env, ctx) {
    if (event.cron === "17 4 * * *") {
      ctx.waitUntil(
        runRoleSync({
          env,
          api: createApi({ host: env.CHIPS_API_HOST, token: env.CHIPS_TOKEN }),
          registry: d1Registry(env.DB),
        })
      );
      return;
    }
    ctx.waitUntil(feedClient(env).watchdog());
  },
};

/**
 * Relay -> bot (Chips Desk). Bound by vipdesk-relay as service "chips-bot", entrypoint
 * "InboxBridge"; never on the public fetch path. Errors thrown here reach the relay as-is:
 * "blocked by user" (Telegram 403), "dms closed" (Discord 50007).
 */
export class InboxBridge extends WorkerEntrypoint {
  send(p) {
    if (p?.platform === "telegram") return telegramSend(this.env, p);
    if (p?.platform === "discord") return discordSend(this.env, p);
    throw new Error(`unknown platform ${p?.platform}`);
  }
  verifyInitData(p) {
    return verifyInitData(
      {
        env: this.env,
        api: createApi({
          host: this.env.CHIPS_API_HOST,
          token: this.env.CHIPS_TOKEN,
        }),
        links: d1Links(this.env.DB),
      },
      p
    );
  }
  // ponytail: Telegram only (the companion pushes there); Discord when someone needs it
  notify(p) {
    if (p?.platform !== "telegram") throw new Error("notify: telegram only");
    return telegramNotify(this.env, p);
  }
}
