/**
 * Node runtime for the Chips bot. Same app.js, same commands, same platform handlers
 * as the Cloudflare Worker; only the runtime services differ:
 *
 *   feed      in-process FeedCore over Node's built-in WebSocket (one socket per process)
 *   metrics   node:sqlite file (DATA_DIR/metrics.sqlite) or memory when DATA_DIR is unset
 *   static    ./public served from disk
 *   alarm     setTimeout
 *
 * Zero runtime dependencies beyond Node >= 22.5 (fetch, WebSocket, WebCrypto, node:sqlite).
 *
 *   node src/adapters/node.js            # or: npm run start:node
 *
 * Env (same names as the Worker; see ../../.env.example):
 *   PORT (default 5000)  HOST (default 0.0.0.0)  DATA_DIR  PUBLIC_URL (for /health wiring checks)
 *   ENVIRONMENT  VERSION  CHIPS_API_HOST  CHIPS_TOKEN
 *   DISCORD_TOKEN  DISCORD_APPLICATION_ID  DISCORD_PUBLIC_KEY
 *   TELEGRAM_TOKEN  TELEGRAM_WEBHOOK_SECRET
 *
 * Discord/Telegram both need a public HTTPS URL to reach this process (a reverse proxy or
 * `cloudflared tunnel --url http://localhost:5000` for local testing), then point them at
 * it with scripts/register-*.js exactly as for the Worker.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createApp } from "../app.js";
import { FEED_HOST, FEED_USER_AGENT, FeedCore } from "../feed/core.js";
import { createApi } from "../lib/chips.js";
import { memoryMetrics, sqliteMetrics } from "../lib/metrics.js";
import {
  memoryRegistry,
  runRoleSync,
  sqliteRegistry,
} from "../lib/rolesync.js";
import { runWatchdog } from "../lib/watchdog.js";

const noop = () => undefined;

const here = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = resolve(here, "../../public");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

// ---- env -> config (Worker gets these as bindings; here it's process.env) ----
export function envFromProcess(pe = process.env) {
  return {
    ENVIRONMENT: pe.ENVIRONMENT || "node",
    VERSION: pe.VERSION || "unstamped-node",
    COMMIT: pe.COMMIT || "unknown",
    BUILT_AT: pe.BUILT_AT || null,
    CHIPS_API_HOST: pe.CHIPS_API_HOST || "https://api.chips.gg/prod/api",
    CHIPS_TOKEN: pe.CHIPS_TOKEN,
    DISCORD_TOKEN: pe.DISCORD_TOKEN,
    DISCORD_APPLICATION_ID: pe.DISCORD_APPLICATION_ID,
    DISCORD_PUBLIC_KEY: pe.DISCORD_PUBLIC_KEY,
    DISCORD_ROLES_GUILD_ID: pe.DISCORD_ROLES_GUILD_ID,
    BROADCAST_DISCORD_CHANNELS: pe.BROADCAST_DISCORD_CHANNELS,
    BROADCAST_TELEGRAM_CHATS: pe.BROADCAST_TELEGRAM_CHATS,
    BROADCAST_MIN_USD: pe.BROADCAST_MIN_USD,
    BROADCAST_MIN_MULTIPLIER: pe.BROADCAST_MIN_MULTIPLIER,
    BROADCAST_MAX_PER_FLUSH: pe.BROADCAST_MAX_PER_FLUSH,
    TELEGRAM_TOKEN: pe.TELEGRAM_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: pe.TELEGRAM_WEBHOOK_SECRET,
    TELEGRAM_BOT_USERNAME: pe.TELEGRAM_BOT_USERNAME,
    PUBLIC_URL: pe.PUBLIC_URL,
    PUBLIC_HOST:
      pe.PUBLIC_HOST ||
      (pe.PUBLIC_URL ? new URL(pe.PUBLIC_URL).host : undefined),
    ALERT_TELEGRAM_CHAT: pe.ALERT_TELEGRAM_CHAT,
  };
}

// ---- services ----
export function nodeFeed(env = {}) {
  let timer = null;
  const core = new FeedCore({
    env,
    openSocket: async () => {
      const ws = new WebSocket(FEED_HOST, {
        headers: { "User-Agent": FEED_USER_AGENT },
      });
      await new Promise((ok, fail) => {
        ws.addEventListener("open", ok, { once: true });
        ws.addEventListener(
          "error",
          () => fail(new Error("feed: websocket connect failed")),
          { once: true }
        );
      });
      return ws;
    },
    schedule: (ms) => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await core.alarm();
        await core.poll(
          createApi({ host: env.CHIPS_API_HOST, token: env.CHIPS_TOKEN })
        );
      }, ms);
      timer.unref?.();
    },
  });
  return {
    core,
    status: () => core.status(),
    mark: (platform) => core.mark(platform).catch(() => undefined),
    ratelimit: async (key) => core.ratelimit(key),
    get: (...paths) => core.get(...paths),
    close: () => {
      clearTimeout(timer);
      core.ws?.close();
    },
  };
}

export async function nodeStores(dataDir) {
  if (!dataDir) return { metrics: memoryMetrics(), registry: memoryRegistry() };
  const { DatabaseSync } = await import("node:sqlite");
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, "metrics.sqlite"));
  return { metrics: sqliteMetrics(db), registry: sqliteRegistry(db) };
}

// ---- static files ----
function serveStatic(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(
    /^(\.\.[/\\])+/,
    ""
  );
  let file = join(PUBLIC_DIR, clean === "/" ? "/index.html" : clean);
  if (!file.startsWith(PUBLIC_DIR))
    return new Response("Not found", { status: 404 });
  if (existsSync(file) && statSync(file).isDirectory())
    file = join(file, "index.html");
  if (!existsSync(file)) return new Response("Not found", { status: 404 });
  const type = MIME[extname(file)] || "application/octet-stream";
  const cache = extname(file) === ".html" ? "no-cache" : "public, max-age=3600";
  return new Response(Readable.toWeb(createReadStream(file)), {
    headers: { "content-type": type, "cache-control": cache },
  });
}

// ---- node http <-> fetch Request/Response ----
function toRequest(req, publicUrl) {
  const base = publicUrl || `http://${req.headers.host || "localhost"}`;
  const url = new URL(req.url, base);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) for (const x of v) headers.append(k, x);
    else if (v != null) headers.set(k, v);
  }
  const hasBody = !["GET", "HEAD"].includes(req.method);
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

async function sendResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  if (!response.body) return res.end();
  for await (const chunk of response.body) res.write(chunk);
  res.end();
}

// ---- assemble ----
export async function createNodeServer({
  env = envFromProcess(),
  dataDir = process.env.DATA_DIR,
} = {}) {
  const feed = nodeFeed(env);
  const { metrics, registry } = await nodeStores(dataDir);
  const app = createApp({ env, feed, metrics, registry });
  const pending = new Set();
  const waitUntil = (p) => {
    const t = Promise.resolve(p).catch((err) =>
      console.error("[bg]", err?.message || err)
    );
    pending.add(t);
    t.finally(() => pending.delete(t));
  };

  const server = createServer(async (req, res) => {
    try {
      const request = toRequest(req, env.PUBLIC_URL);
      const out =
        (await app(request, waitUntil)) ??
        serveStatic(new URL(request.url).pathname);
      await sendResponse(res, out);
    } catch (err) {
      console.error("[http]", req.method, req.url, err?.message || err);
      if (!res.headersSent) res.statusCode = 500;
      res.end("Internal error");
    }
  });

  // warm the feed at boot so the first /health is honest
  feed.core
    .ensureConnected()
    .catch((err) => console.error("[feed]", err.message));

  // daily VIP rank -> Discord role sync (same code the Worker cron runs)
  const roleSyncTimer = setInterval(
    () =>
      runRoleSync({
        env,
        api: createApi({ host: env.CHIPS_API_HOST, token: env.CHIPS_TOKEN }),
        registry,
      }).catch(noop),
    24 * 60 * 60_000
  );
  roleSyncTimer.unref?.();

  // uptime watchdog (same code the Worker cron runs) when configured
  let watchdogTimer = null;
  if (env.ALERT_TELEGRAM_CHAT && env.PUBLIC_HOST) {
    watchdogTimer = setInterval(
      () => runWatchdog({ env, storage: feed.core.storage }).catch(noop),
      60_000
    );
    watchdogTimer.unref?.();
  }

  const close = async () => {
    clearInterval(watchdogTimer);
    clearInterval(roleSyncTimer);
    await new Promise((ok) => server.close(ok));
    feed.close();
    await Promise.allSettled([...pending]);
  };
  return { server, feed, metrics, close };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 5000);
  const host = process.env.HOST || "0.0.0.0";
  const { server, close } = await createNodeServer();
  server.listen(port, host, () => {
    console.log(
      `chips-bot (node) listening on http://${host}:${port}  env=${process.env.ENVIRONMENT || "node"} version=${process.env.VERSION || "unstamped-node"}`
    );
  });
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, async () => {
      console.log(`${sig}: shutting down`);
      await close();
      process.exit(0);
    });
  }
}
