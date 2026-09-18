/**
 * Cloudflare Workers entry. All routing lives in ./app.js; this file wires the
 * Cloudflare services: Durable Object feed, D1 metrics, ASSETS for the landing page.
 */
import { createApp } from "./app.js";
import { feedClient } from "./feed/chips-feed.js";
import { d1Metrics } from "./lib/metrics.js";

export { ChipsFeed } from "./feed/chips-feed.js";

export default {
  async fetch(request, env, ctx) {
    const app = createApp({
      env,
      feed: feedClient(env),
      metrics: d1Metrics(env.DB),
    });
    const res = await app(request, (p) => ctx.waitUntil(p));
    return res ?? env.ASSETS.fetch(request);
  },

  // wrangler.toml [triggers] crons: probe our own public /health, alert on transitions
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(feedClient(env).watchdog());
  },
};
