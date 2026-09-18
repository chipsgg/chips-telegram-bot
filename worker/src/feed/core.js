/**
 * FeedCore — the portable half of the Chips realtime feed.
 *
 * Holds ONE outbound WebSocket to api.chips.gg and the state it pushes. The Chips API
 * ships some data only as realtime state (never via RPC): currencies/prices (public),
 * bigwins + luckiest leaderboards (stats), profitshare.
 *
 * Runtime-specific pieces are injected so the same class runs inside a Durable Object
 * (feed/chips-feed.js) or a plain Node process (adapters/node.js):
 *   openSocket()        -> WebSocket-like: readyState, send, addEventListener(message|close|error)
 *   storage.get/put     -> persistence for activity counters (DO storage / sqlite / memory)
 *   schedule(ms)        -> arrange for alarm() to run in ms (DO alarm / setTimeout)
 *
 * Wire format (from @chipsgg/openservice-ws-client):
 *   frame        = JSON array of messages
 *   rpc message  = [channel, id, result, err]
 *   push message = [channel, null, [path, data]]   path=[] => replace channel root
 *                                                    data=null => unset at path
 * Outbound RPC: [channel, id, action, [params]]
 *
 * Lifecycle: alarm() every ALARM_MS reconnects if the socket is dead and re-asserts
 * subscriptions (the server drops idle ones). No auth: all four feeds are public.
 */

import { RateLimiter } from "../lib/ratelimit.js";

export const FEED_HOST = "wss://api.chips.gg/prod/socket";
export const FEED_USER_AGENT = "Mozilla/5.0 (compatible; chips-bot-feed/4.0)";
export const ALARM_MS = 60_000;
const STALE_MS = 5 * 60_000;
const CONNECT_GRACE_MS = 15_000;

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

export const setPath = (root, path, value) => {
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

const noop = () => undefined;

export const memoryStorage = () => {
  const m = new Map();
  return {
    get: async (k) => m.get(k),
    put: async (k, v) => {
      m.set(k, v);
    },
  };
};

export class FeedCore {
  constructor({
    openSocket,
    storage = memoryStorage(),
    schedule = noop,
    rateLimit = {},
  }) {
    this.openSocket = openSocket;
    this.storage = storage;
    this.schedule = schedule;
    this.ws = null;
    this.rid = 0;
    this.data = { public: {}, stats: {}, profitshare: {} };
    this.updatedAt = 0;
    this.connectedAt = 0;
    this.connecting = null;
    this.reconnects = 0;
    this.activity = null; // last-seen per platform (ms) + handled counts
    // per-user command limiter lives here because there is exactly one core per deployment
    this.limiter = new RateLimiter(rateLimit);
  }

  ratelimit(key) {
    return this.limiter.hit(key);
  }

  async loadActivity() {
    if (this.activity) return this.activity;
    this.activity = (await this.storage.get("activity")) || {};
    return this.activity;
  }

  // ---- the three operations the app needs (mirrors feedClient) ----
  async status() {
    await this.ensureConnected().catch(noop);
    return { ...this.snapshot(), activity: await this.loadActivity() };
  }

  async mark(platform) {
    if (!platform || !/^[a-z]+$/.test(platform)) return;
    const a = await this.loadActivity();
    a[platform] = Date.now();
    a[`${platform}_count`] = (a[`${platform}_count`] || 0) + 1;
    await this.storage.put("activity", a);
  }

  async get(...paths) {
    await this.ensureConnected().catch(noop);
    const out = {};
    for (const p of paths) out[p] = this.read(p);
    return { updatedAt: this.updatedAt, stale: this.isStale(), data: out };
  }

  snapshot() {
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

  // Stale = no push for STALE_MS. A fresh connection gets a grace window before the
  // first push counts against it (a new instance after deploy has updatedAt=0).
  isStale() {
    if (this.updatedAt) return Date.now() - this.updatedAt > STALE_MS;
    if (this.connectedAt)
      return Date.now() - this.connectedAt > CONNECT_GRACE_MS;
    return true;
  }

  read(dotted) {
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
    const ws = await this.openSocket();
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
    await this.schedule(ALARM_MS);
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
    await this.schedule(ALARM_MS);
  }
}
