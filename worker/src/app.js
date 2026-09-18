/**
 * The bot as a plain (Request) -> Response function. No Cloudflare imports.
 *
 * Routes:
 *   POST /discord            Discord Interactions endpoint
 *   POST /telegram           Telegram webhook
 *   GET  /api/command/:name  HTTP demo API (landing page "live demo"); identity commands 404
 *   GET  /api/metrics        lifetime usage counters (landing page)
 *   GET  /api/usage?days=30  per-command usage rollup (which commands anyone actually runs)
 *   GET  /api/ticker         live prices for the landing-page ticker (from the feed)
 *   GET  /health             200 when feed is fresh AND Discord/Telegram point at this host; else 503
 *   GET  /commands.json      command list (for the landing page)
 *   anything else            -> null (caller serves static assets / 404)
 *
 * Runtime services are injected:
 *   env        config + secrets (VERSION, CHIPS_TOKEN, DISCORD_*, TELEGRAM_*, ...)
 *   feed       { status(), mark(platform), get(...paths) }   (DO stub or in-process FeedCore)
 *   metrics    { track(platform, command, ok), read(), usage() }
 *   registry   { upsert, list, count }  linked Discord users, for the daily role sync
 *   waitUntil  (promise) => void  keep the runtime alive until background work finishes
 */
import { commands } from "./commands/index.js";
import {
  THUMB_BASE,
  bigWinForm,
  broadcastConfig,
  deliver,
  detectBigWins,
  promoForm,
  resolveGameImage,
} from "./lib/broadcast.js";
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

export function createApp({ env, feed, metrics, registry }) {
  const deps = {
    env,
    feed,
    metrics,
    registry,
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

    // Non-production only: post a synthetic big-win to the configured broadcast targets so
    // channel wiring can be verified without waiting for the casino floor.
    if (
      request.method === "POST" &&
      url.pathname === "/api/broadcast-test" &&
      env.ENVIRONMENT !== "production"
    ) {
      const kind = url.searchParams.get("kind") || "bigwin";
      // ?real=1: use the live board / running promotions instead of synthetic values
      if (url.searchParams.has("real")) {
        const cfg = broadcastConfig(env);
        if (kind === "promotion") {
          const running = await deps.api.public("listRunningPromotions", {});
          const list = (Array.isArray(running) ? running : []).slice(
            0,
            Math.min(3, Number(url.searchParams.get("n")) || 1)
          );
          const sent = [];
          for (const p of list)
            sent.push({
              title: p.title,
              ...(await deliver(env, cfg, promoForm(p))),
            });
          return json({ kind, real: true, sent });
        }
        const { data } = await feed.get(
          "stats.bets.bigwins",
          "public.currencies"
        );
        // run the same detection with an empty seen set, then take the top N regardless of threshold
        const all = detectBigWins(
          data["stats.bets.bigwins"],
          data["public.currencies"],
          new Set(["_"]),
          { ...cfg, minUsd: 0, minMultiplier: 0, maxPerFlush: 25 }
        ).events;
        const pick = all.slice(
          0,
          Math.min(3, Number(url.searchParams.get("n")) || 1)
        );
        const sent = [];
        for (const e of pick) {
          e.gameImage = await resolveGameImage(e.gameSlug, e.gameImage);
          sent.push({
            who: e.username,
            win: e.winningsUsd,
            x: e.multiplier,
            game: e.game,
            img: Boolean(e.gameImage),
            customThumb: Boolean(e.gameImage?.startsWith(THUMB_BASE)),
            avatar: Boolean(e.avatar),
            ...(await deliver(env, cfg, bigWinForm(e))),
          });
        }
        return json({ kind, real: true, sent });
      }
      const form =
        kind === "promotion"
          ? promoForm({
              promotionid: "TEST",
              title: "$1,000 Broadcast Test Race",
              subtitle:
                "Synthetic promotion card to verify channel wiring. Wager on any slot to climb the board.",
              category: "casino",
              startTime: Date.now(),
              endTime: Date.now() + 7 * 86_400_000,
              bannerImage:
                "https://cdn.redpkt.com/chips/banners/elpasso_banner.webp",
            })
          : bigWinForm({
              username: "test_player",
              avatar:
                "https://cdn.chips.gg/public/images/assets/favicon/favicon-32x32.png",
              rank: "Collector IV",
              game: "Sweet Bonanza 2500",
              gameSlug: "pragmaticplay-sweet-bonanza-2500",
              gameImage:
                "https://cdn.hub88.io/pragmatic/pgp_sweetbonanza2500.jpg",
              provider: "pragmaticplay",
              currency: "eth",
              amountUsd: 12.5,
              winningsUsd: 4_321,
              multiplier: 345.7,
              at: Date.now(),
            });
      const r = await deliver(env, broadcastConfig(env), form);
      return json({ kind, sent: r });
    }

    if (url.pathname === "/api/usage") {
      const days = Math.min(
        365,
        Math.max(1, Number(url.searchParams.get("days")) || 30)
      );
      return json(await metrics.usage({ days }));
    }

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
      const ip =
        request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        "unknown";
      // API tier is per IP, so it is looser than the per-user chat tiers (shared NATs, the
      // landing page demo). Non-production honours x-smoke-bypass so the smoke suite can run.
      const bypass =
        env.ENVIRONMENT !== "production" &&
        request.headers.get("x-smoke-bypass") === "1";
      const rl = bypass
        ? { allowed: true }
        : await feed.ratelimit(`api:${ip}`, "api");
      if (!rl.allowed)
        return json(
          { error: "Rate limited", retryAfterSec: rl.retryAfterSec },
          429,
          {
            "retry-after": String(rl.retryAfterSec),
          }
        );
      try {
        const c = apiCtx(url);
        await command.handler(c, deps);
        waitUntil(metrics.track("api", m[1], true));
        waitUntil(feed.mark("api"));
        return json(c.result() || { error: "No response" });
      } catch (err) {
        console.error(`[api] /${m[1]} failed:`, err.message);
        waitUntil(metrics.track("api", m[1], false));
        return json({ error: "Command failed" }, 500);
      }
    }

    return null;
  };
}
