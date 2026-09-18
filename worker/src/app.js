/**
 * The bot as a plain (Request) -> Response function. No Cloudflare imports.
 *
 * Routes:
 *   POST /discord            Discord Interactions endpoint
 *   POST /telegram           Telegram webhook
 *   GET  /api/command/:name  HTTP demo API (landing page "live demo"); identity commands 404
 *   GET  /api/metrics        usage counters
 *   GET  /api/ticker         live prices for the landing-page ticker (from the feed)
 *   GET  /health             200 when feed is fresh AND Discord/Telegram point at this host; else 503
 *   GET  /commands.json      command list (for the landing page)
 *   anything else            -> null (caller serves static assets / 404)
 *
 * Runtime services are injected:
 *   env        config + secrets (VERSION, CHIPS_TOKEN, DISCORD_*, TELEGRAM_*, ...)
 *   feed       { status(), mark(platform), get(...paths) }   (DO stub or in-process FeedCore)
 *   metrics    { track(platform), read() }
 *   waitUntil  (promise) => void  keep the runtime alive until background work finishes
 */
import { commands } from "./commands/index.js";
import { createApi } from "./lib/chips.js";
import { formatPrice } from "./lib/format.js";
import { buildHealth } from "./lib/health.js";
import { handleDiscord } from "./platform/discord.js";
import { handleTelegram } from "./platform/telegram.js";

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
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

const swallow = (p) => Promise.resolve(p).catch(() => undefined);

export function createApp({ env, feed, metrics }) {
  const deps = {
    env,
    feed,
    metrics,
    api: createApi({ host: env.CHIPS_API_HOST, token: env.CHIPS_TOKEN }),
  };

  return async function handle(request, waitUntil = swallow) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/discord")
      return handleDiscord(request, env, deps, waitUntil);
    if (request.method === "POST" && url.pathname === "/telegram")
      return handleTelegram(request, env, deps, waitUntil);

    if (url.pathname === "/health") {
      const health = await buildHealth({
        env,
        feed,
        host: url.hostname,
        fresh: url.searchParams.has("fresh"),
      });
      return json(health, health.ok ? 200 : 503);
    }

    if (url.pathname === "/api/metrics") return json(await metrics.read());

    if (url.pathname === "/api/ticker") {
      const { data, updatedAt } = await feed.get("public.currencies");
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
        await command.handler(c, deps);
        waitUntil(metrics.track("api"));
        waitUntil(feed.mark("api"));
        return json(c.result() || { error: "No response" });
      } catch (err) {
        console.error(`[api] /${m[1]} failed:`, err.message);
        return json({ error: "Command failed" }, 500);
      }
    }

    return null;
  };
}
