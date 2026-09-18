/**
 * ChipsFeed — Durable Object holding ONE outbound WebSocket to api.chips.gg.
 *
 * The Chips API pushes some data only as realtime state (never via RPC):
 * currencies/prices (public), bigwins + luckiest leaderboards (stats), profitshare.
 * This DO keeps that state warm and serves it to the Worker over a tiny internal
 * HTTP interface. One instance ("main") for the whole deployment.
 *
 * Wire format (from @chipsgg/openservice-ws-client):
 *   frame        = JSON array of messages
 *   rpc message  = [channel, id, result, err]
 *   push message = [channel, null, [path, data]]   path=[] => replace channel root
 *                                                    data=null => unset at path
 * Outbound RPC: [channel, id, action, [params]]
 *
 * Lifecycle: an alarm every 60s reconnects if the socket is dead and re-asserts
 * subscriptions (the server drops idle ones). No auth needed: all four feeds are public.
 */

const HOST = "wss://api.chips.gg/prod/socket";
const ALARM_MS = 60_000;
const STALE_MS = 5 * 60_000;

const SUBSCRIPTIONS = [
  ["stats", "on", { game: "bets", type: "bigwins" }],
  ["stats", "on", { game: "bets", type: "luckiest" }],
  ["profitshare", "on", { name: "profitshareInfo" }],
  ["profitshare", "on", { name: "profitshareBalance" }],
];

// Only these branches are kept; everything else the server pushes is dropped.
const KEEP = {
  public: new Set(["currencies", "settings"]),
  stats: null, // keep all (bets.bigwins / bets.luckiest)
  profitshare: null,
};

const setPath = (root, path, value) => {
  if (!path.length) return value;
  const out = { ...(root && typeof root === "object" ? root : {}) };
  let cur = out;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    cur[k] = cur[k] && typeof cur[k] === "object" ? { ...cur[k] } : {};
    cur = cur[k];
  }
  const last = path[path.length - 1];
  if (value === null || value === undefined) delete cur[last];
  else cur[last] = value;
  return out;
};

export class ChipsFeed {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.ws = null;
    this.rid = 0;
    this.data = { public: {}, stats: {}, profitshare: {} };
    this.updatedAt = 0;
    this.connectedAt = 0;
    this.connecting = null;
    this.reconnects = 0;
    // last-seen per platform (ms) + handled counts; persisted so they survive DO eviction
    this.activity = null;
  }

  async loadActivity() {
    if (this.activity) return this.activity;
    this.activity = (await this.state.storage.get("activity")) || {};
    return this.activity;
  }

  // ---- internal HTTP interface (called by the Worker via stub.fetch) ----
  async fetch(request) {
    const url = new URL(request.url);
    await this.ensureConnected();

    if (url.pathname === "/status") {
      return Response.json({
        ...this.status(),
        activity: await this.loadActivity(),
      });
    }
    if (url.pathname === "/mark") {
      // record "platform X delivered something we handled just now"
      const platform = url.searchParams.get("platform");
      if (platform && /^[a-z]+$/.test(platform)) {
        const a = await this.loadActivity();
        a[platform] = Date.now();
        a[`${platform}_count`] = (a[`${platform}_count`] || 0) + 1;
        await this.state.storage.put("activity", a);
      }
      return new Response("ok");
    }
    if (url.pathname === "/state") {
      const paths = (url.searchParams.get("paths") || "")
        .split(",")
        .filter(Boolean);
      const out = {};
      for (const p of paths) out[p] = this.get(p);
      return Response.json({
        updatedAt: this.updatedAt,
        stale: this.isStale(),
        data: out,
      });
    }
    return new Response("not found", { status: 404 });
  }

  status() {
    return {
      connected: this.ws?.readyState === 1,
      connectedAt: this.connectedAt,
      updatedAt: this.updatedAt,
      stale: this.isStale(),
      reconnects: this.reconnects,
      bigwins: Object.keys(this.data.stats?.bets?.bigwins || {}).length,
      luckiest: Object.keys(this.data.stats?.bets?.luckiest || {}).length,
      currencies: Object.keys(this.data.public?.currencies || {}).length,
    };
  }

  // Stale = no push for STALE_MS. A fresh connection gets a 15s grace window before
  // the first push counts against it (new DO instance after deploy has updatedAt=0).
  isStale() {
    if (this.updatedAt) return Date.now() - this.updatedAt > STALE_MS;
    if (this.connectedAt) return Date.now() - this.connectedAt > 15_000;
    return true;
  }

  get(dotted) {
    return dotted
      .split(".")
      .reduce((o, k) => (o == null ? undefined : o[k]), this.data);
  }

  // ---- websocket lifecycle ----
  async ensureConnected() {
    if (this.ws && this.ws.readyState === 1) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  async connect() {
    // No Origin header (the CF worker in front of the API rejects browser origins).
    const res = await fetch(HOST.replace("wss://", "https://"), {
      headers: {
        Upgrade: "websocket",
        "User-Agent": "Mozilla/5.0 (compatible; chips-bot-feed/4.0)",
      },
    });
    const ws = res.webSocket;
    if (!ws) throw new Error(`feed: upgrade failed (${res.status})`);
    ws.accept();

    ws.addEventListener("message", (ev) => this.onMessage(ev.data));
    ws.addEventListener("close", () => {
      if (this.ws === ws) this.ws = null;
    });
    ws.addEventListener("error", () => {
      if (this.ws === ws) this.ws = null;
    });

    this.ws = ws;
    this.connectedAt = Date.now();
    this.reconnects += 1;
    this.subscribe();
    await this.state.storage.setAlarm(Date.now() + ALARM_MS);
  }

  subscribe() {
    if (!this.ws || this.ws.readyState !== 1) return;
    for (const [channel, action, params] of SUBSCRIPTIONS) {
      this.ws.send(JSON.stringify([channel, ++this.rid, action, [params]]));
    }
  }

  onMessage(raw) {
    let frames;
    try {
      frames = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(frames)) return;
    let changed = false;
    for (const msg of frames) {
      if (!Array.isArray(msg) || msg[1] != null) continue; // rpc replies: ignore
      const [channel, , payload] = msg;
      if (!(channel in this.data) || !Array.isArray(payload)) continue;
      const [path = [], value] = payload;
      const keep = KEEP[channel];
      if (path.length === 0) {
        // Root replace: filter to kept branches for `public` (34KB blob, we need 2 keys)
        this.data[channel] =
          keep && value && typeof value === "object"
            ? Object.fromEntries(
                Object.entries(value).filter(([k]) => keep.has(k))
              )
            : value;
        changed = true;
      } else {
        if (keep && !keep.has(path[0])) continue;
        this.data[channel] = setPath(this.data[channel], path, value);
        changed = true;
      }
    }
    if (changed) this.updatedAt = Date.now();
  }

  async alarm() {
    try {
      await this.ensureConnected();
      this.subscribe(); // re-assert; server drops idle subscriptions
    } catch (err) {
      console.error("[feed] reconnect failed:", err.message);
    }
    await this.state.storage.setAlarm(Date.now() + ALARM_MS);
  }
}

// ---- Worker-side accessor ----
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
    // paths: dotted, e.g. "public.currencies", "stats.bets.bigwins"
    get: async (...paths) => {
      const r = await stub().fetch(
        `https://feed/state?paths=${encodeURIComponent(paths.join(","))}`
      );
      return r.json();
    },
  };
}
