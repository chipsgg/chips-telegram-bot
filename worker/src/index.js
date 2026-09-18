/**
 * Cloudflare Workers entry. All routing lives in ./app.js; this file wires the
 * Cloudflare services: Durable Object feed, D1 metrics, ASSETS for the landing page.
 */
import { createApp } from "./app.js";
import { feedClient } from "./feed/chips-feed.js";
import { createApi } from "./lib/chips.js";
import { d1Metrics } from "./lib/metrics.js";
import { d1Registry, runRoleSync } from "./lib/rolesync.js";

export { ChipsFeed } from "./feed/chips-feed.js";

export default {
  async fetch(request, env, ctx) {
    const app = createApp({
      env,
      feed: feedClient(env),
      metrics: d1Metrics(env.DB),
      registry: d1Registry(env.DB),
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
