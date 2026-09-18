/**
 * ChipsFeed — Durable Object wrapper around FeedCore.
 *
 * One instance ("main") per deployment. The Worker talks to it over a tiny internal
 * HTTP interface (stub.fetch): /status, /mark, /state. Everything feed-related lives
 * in ./core.js; this file only supplies the Cloudflare-specific pieces: the websocket
 * upgrade via fetch(), DO storage for activity counters, and the DO alarm.
 */
import { createApi } from "../lib/chips.js";
import { runWatchdog } from "../lib/watchdog.js";
import { ALARM_MS, FEED_HOST, FEED_USER_AGENT, FeedCore } from "./core.js";

export class ChipsFeed {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.core = new FeedCore({
      openSocket: async () => {
        // No Origin header (the CF worker in front of the API rejects browser origins).
        const res = await fetch(FEED_HOST.replace("wss://", "https://"), {
          headers: { Upgrade: "websocket", "User-Agent": FEED_USER_AGENT },
        });
        const ws = res.webSocket;
        if (!ws) throw new Error(`feed: upgrade failed (${res.status})`);
        ws.accept();
        return ws;
      },
      storage: state.storage,
      schedule: (ms) => state.storage.setAlarm(Date.now() + ms),
      env,
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/status")
      return Response.json(await this.core.status());
    if (url.pathname === "/mark") {
      await this.core.mark(url.searchParams.get("platform"));
      return new Response("ok");
    }
    if (url.pathname === "/watchdog") {
      return Response.json(
        await runWatchdog({ env: this.env, storage: this.state.storage })
      );
    }
    if (url.pathname === "/ratelimit") {
      return Response.json(
        this.core.ratelimit(url.searchParams.get("key") || "")
      );
    }
    if (url.pathname === "/state") {
      const paths = (url.searchParams.get("paths") || "")
        .split(",")
        .filter(Boolean);
      return Response.json(await this.core.get(...paths));
    }
    return new Response("not found", { status: 404 });
  }

  async alarm() {
    await this.core.alarm();
    // once a minute is plenty for promotions; runs on the same alarm as the reconnect
    await this.core.poll(
      createApi({ host: this.env.CHIPS_API_HOST, token: this.env.CHIPS_TOKEN })
    );
  }
}

// Worker-side accessor: same shape as FeedCore's status/mark/get, over the DO stub.
export function feedClient(env) {
  const stub = () => env.CHIPS_FEED.get(env.CHIPS_FEED.idFromName("main"));
  return {
    status: () =>
      stub()
        .fetch("https://feed/status")
        .then((r) => r.json()),
    // fire-and-forget liveness mark; never throws
    mark: (platform) =>
      stub()
        .fetch(`https://feed/mark?platform=${encodeURIComponent(platform)}`)
        .catch(() => undefined),
    watchdog: () =>
      stub()
        .fetch("https://feed/watchdog")
        .then((r) => r.json()),
    // per-user limiter; fails OPEN (a DO hiccup must not block every command)
    ratelimit: (key) =>
      stub()
        .fetch(`https://feed/ratelimit?key=${encodeURIComponent(key)}`)
        .then((r) => r.json())
        .catch(() => ({ allowed: true, remaining: 0, retryAfterSec: 0 })),
    // paths: dotted, e.g. "public.currencies", "stats.bets.bigwins"
    get: async (...paths) => {
      const r = await stub().fetch(
        `https://feed/state?paths=${encodeURIComponent(paths.join(","))}`
      );
      return r.json();
    },
  };
}

export { ALARM_MS };
