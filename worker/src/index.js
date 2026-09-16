/**
 * Worker entry. Routes:
 *   POST /discord            Discord Interactions endpoint
 *   POST /telegram           Telegram webhook
 *   GET  /api/command/:name  HTTP demo API (landing page "live demo"); identity commands 404
 *   GET  /api/metrics        usage counters (D1)
 *   GET  /api/ticker         live prices for the landing-page ticker (from the feed DO)
 *   GET  /health             200 when the feed is connected + fresh, else 503
 *   GET  /commands.json      command list (for the landing page)
 *   GET  /*                  static assets (ASSETS binding, ./public)
 */
import { commands } from "./commands/index.js";
import { feedClient } from "./feed/chips-feed.js";
import { createApi } from "./lib/chips.js";
import { formatPrice } from "./lib/format.js";
import { getMetrics, track } from "./lib/metrics.js";
import { handleDiscord } from "./platform/discord.js";
import { handleTelegram } from "./platform/telegram.js";

export { ChipsFeed } from "./feed/chips-feed.js";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });

const deps = (env) => ({
  env,
  api: createApi({ host: env.CHIPS_API_HOST, token: env.CHIPS_TOKEN }),
  feed: feedClient(env),
});

// HTTP demo ctx: query params are named args; ?args=a+b+c gives positional args
function apiCtx(url) {
  const positional = (url.searchParams.get("args") || "")
    .split(/\s+/)
    .filter(Boolean);
  let result = null;
  return {
    platform: "api",
    userid: null,
    isPrivate: false,
    getString: (name, index = 1) =>
      url.searchParams.get(name) ?? positional[index - 1],
    rest: (from = 1) => positional.slice(from - 1).join(" "),
    sendForm: (form) => {
      result = form;
      return form;
    },
    sendText: (text) => {
      result = { text };
      return result;
    },
    result: () => result,
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const d = deps(env);

    if (request.method === "POST" && url.pathname === "/discord")
      return handleDiscord(request, env, d, (p) => ctx.waitUntil(p));
    if (request.method === "POST" && url.pathname === "/telegram")
      return handleTelegram(request, env, d, (p) => ctx.waitUntil(p));

    if (url.pathname === "/health") {
      const feed = await d.feed
        .status()
        .catch((e) => ({ connected: false, error: e.message }));
      const ok = feed.connected && !feed.stale;
      return json(
        {
          ok,
          feed,
          version: env.VERSION || "dev",
          environment: env.ENVIRONMENT || "unknown",
        },
        ok ? 200 : 503
      );
    }

    if (url.pathname === "/api/metrics") return json(await getMetrics(env));

    if (url.pathname === "/api/ticker") {
      const { data, updatedAt } = await d.feed.get("public.currencies");
      const rows = Object.values(data["public.currencies"] || {})
        .filter(
          (c) =>
            c &&
            !c.hidden &&
            !c.name.startsWith("usd") &&
            !c.name.endsWith("usd") &&
            c.name !== "chips" &&
            c.name !== "chips_staking"
        )
        .sort((a, b) => b.price - a.price)
        .map((c) => ({
          symbol: c.name.toUpperCase(),
          price: c.price,
          label: formatPrice(c.price),
        }));
      return json({ updatedAt, rows }, 200, {
        "cache-control": "public, max-age=15",
      });
    }

    if (url.pathname === "/commands.json") {
      return json(
        Object.values(commands)
          .filter((c) => !c.staffOnly)
          .map((c) => ({ name: c.name, description: c.description })),
        200,
        { "cache-control": "public, max-age=300" }
      );
    }

    const m = url.pathname.match(/^\/api\/command\/([a-z]+)$/);
    if (m) {
      const command = commands[m[1]];
      if (!command || command.identity)
        return json({ error: "Command not found" }, 404);
      try {
        const c = apiCtx(url);
        await command.handler(c, d);
        ctx.waitUntil(track(env, "api"));
        return json(c.result() || { error: "No response" });
      } catch (err) {
        console.error(`[api] /${m[1]} failed:`, err.message);
        return json({ error: "Command failed" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
