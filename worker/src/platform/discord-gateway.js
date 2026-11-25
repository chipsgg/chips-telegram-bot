import { feedClient } from "../feed/chips-feed.js";
import { createApi } from "../lib/chips.js";
import { d1Links } from "../lib/links.js";
import { discordDm } from "./discord.js";

/**
 * Discord gateway for plain DMs. Discord sends ordinary messages (DMs included) only over the
 * gateway WebSocket, never to the HTTP interactions endpoint, so a Durable Object holds one
 * open (an outbound socket keeps a DO alive). Same shape as ChipsFeed: GatewayCore is plain
 * and testable, the DO only supplies the socket and storage. The per-minute cron calls ensure().
 *
 * Mode = env.DISCORD_GATEWAY: "on" files DMs via discordDm, "shadow" connects and counts only,
 * anything else closes the socket. Protocol: discord.com/developers/docs/events/gateway
 */
export const GATEWAY_URL = "wss://gateway.discord.gg";
const QUERY = "/?v=10&encoding=json";
const INTENTS = 1 << 12; // DIRECT_MESSAGES, not privileged
const FATAL = new Set([4004, 4010, 4011, 4012, 4013, 4014]); // bad token / intents / version
const IDENTIFY_GAP_MS = 120_000; // Discord allows 1000 identifies a day; a flap can't burn them
const MODES = new Set(["on", "shadow"]);

export class GatewayCore {
  constructor({
    openSocket,
    storage,
    token,
    onDm,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    now = Date.now,
  }) {
    Object.assign(this, {
      openSocket,
      storage,
      token,
      onDm,
      setTimer,
      clearTimer,
      now,
    });
    this.ws = null;
    this.mode = null;
    this.beat = null;
    this.acked = true;
    this.session = null; // { id, seq, resumeUrl, lastIdentify, fatal } persisted
    this.stats = {
      connectedAt: 0,
      lastAck: 0,
      dms: 0,
      lastDm: null,
      identifies: 0,
      resumes: 0,
    };
  }

  async load() {
    this.session ??= (await this.storage.get("gateway")) || {};
    return this.session;
  }

  save() {
    return this.storage.put("gateway", this.session);
  }

  async ensure(mode) {
    this.mode = mode;
    if (!MODES.has(mode)) {
      // off means off: close with 1000 (ends the session) and forget it, fatal included
      await this.drop(1000);
      if (Object.keys(await this.load()).length) {
        this.session = {};
        await this.save();
      }
      return;
    }
    if (this.ws || this.connecting) return;
    const s = await this.load();
    if (s.fatal) return;
    const resume = Boolean(s.id && s.resumeUrl);
    if (!resume && this.now() - (s.lastIdentify || 0) < IDENTIFY_GAP_MS) return;
    this.connecting = true;
    try {
      const ws = await this.openSocket(
        (resume ? s.resumeUrl : GATEWAY_URL) + QUERY
      );
      ws.addEventListener(
        "message",
        (ev) => this.ws === ws && this.onMessage(ev.data)
      );
      ws.addEventListener(
        "close",
        (ev) => this.ws === ws && this.onClose(ev.code)
      );
      ws.addEventListener("error", () => this.ws === ws && this.onClose(1006));
      this.ws = ws;
      this.stats.connectedAt = this.now();
      console.log("[gateway] connected", resume ? "resume" : "identify");
    } finally {
      this.connecting = false;
    }
  }

  send(op, d) {
    this.ws?.send(JSON.stringify({ op, d }));
  }

  heartbeat(ms) {
    if (!this.acked) return this.drop(4000); // zombie: no ACK since the last beat, resume
    this.acked = false;
    this.send(1, this.session.seq ?? null);
    this.beat = this.setTimer(() => this.heartbeat(ms), ms);
  }

  async onMessage(raw) {
    let p;
    try {
      p = JSON.parse(raw);
    } catch {
      return;
    }
    const s = this.session;
    if (p.s != null) s.seq = p.s;
    if (p.op === 10) {
      const ms = p.d.heartbeat_interval;
      this.acked = true;
      this.beat = this.setTimer(
        () => this.heartbeat(ms),
        Math.floor(ms * Math.random())
      );
      if (s.id && s.resumeUrl)
        return this.send(6, {
          token: this.token,
          session_id: s.id,
          seq: s.seq ?? null,
        });
      s.lastIdentify = this.now();
      this.stats.identifies += 1;
      await this.save();
      return this.send(2, {
        token: this.token,
        intents: INTENTS,
        properties: { os: "linux", browser: "chips-bot", device: "chips-bot" },
      });
    }
    if (p.op === 11) {
      this.acked = true;
      this.stats.lastAck = this.now();
      return;
    }
    if (p.op === 1) return this.send(1, s.seq ?? null);
    if (p.op === 7) return this.drop(4000); // Discord asks us to reconnect: resume
    if (p.op === 9) {
      if (!p.d) this.clearSession(); // not resumable: identify again
      return this.drop(4000);
    }
    if (p.op !== 0) return;
    if (p.t === "READY") {
      s.id = p.d.session_id;
      s.resumeUrl = p.d.resume_gateway_url;
      console.log("[gateway] ready");
    }
    if (p.t === "RESUMED") {
      this.stats.resumes += 1;
      console.log("[gateway] resumed at seq", s.seq);
    }
    await this.save(); // seq after every dispatch, so a deploy restart resumes where it was
    const m = p.d;
    if (p.t !== "MESSAGE_CREATE" || m.guild_id || m.author?.bot) return;
    this.stats.dms += 1;
    this.stats.lastDm = m.id;
    if (this.mode === "on") this.onDm({ channel_id: m.channel_id, id: m.id });
  }

  clearSession() {
    const { lastIdentify, fatal } = this.session;
    this.session = { lastIdentify, fatal };
  }

  async onClose(code) {
    console.log("[gateway] closed by Discord", code);
    this.reset();
    if (FATAL.has(code)) this.session.fatal = code;
    if (code === 4007 || code === 4009) this.clearSession(); // bad seq / session timed out
    await this.save();
    if (!this.session.fatal) this.retry();
  }

  reset() {
    if (this.beat) this.clearTimer(this.beat);
    this.beat = null;
    this.ws = null;
  }

  // Our own close. 4000 keeps the session resumable; 1000 ends it.
  async drop(code) {
    const ws = this.ws;
    if (!ws) return;
    console.log("[gateway] closing", code);
    this.reset();
    if (code === 1000) this.clearSession();
    try {
      ws.close(code);
    } catch {
      // already closed
    }
    await this.save();
    if (code !== 1000) this.retry();
  }

  retry() {
    this.setTimer(
      () =>
        this.ensure(this.mode).catch((e) =>
          console.error("[gateway] reconnect failed:", e.message)
        ),
      1000
    );
  }

  status() {
    const ago = (t) => (t ? Math.round((this.now() - t) / 1000) : null);
    return {
      mode: this.mode,
      connected: this.ws?.readyState === 1,
      session: Boolean(this.session?.id),
      lastAckAgoSec: ago(this.stats.lastAck),
      connectedAgoSec: ago(this.stats.connectedAt),
      dms: this.stats.dms,
      lastDm: this.stats.lastDm,
      identifies: this.stats.identifies,
      resumes: this.stats.resumes,
      fatal: this.session?.fatal || null,
    };
  }
}

export class DiscordGateway {
  constructor(state, env) {
    this.env = env;
    const deps = {
      env,
      feed: feedClient(env),
      links: d1Links(env.DB),
      api: createApi({ host: env.CHIPS_API_HOST, token: env.CHIPS_TOKEN }),
    };
    this.core = new GatewayCore({
      token: env.DISCORD_TOKEN,
      storage: state.storage,
      openSocket: async (url) => {
        const res = await fetch(url.replace("wss://", "https://"), {
          headers: { Upgrade: "websocket" },
        });
        if (!res.webSocket)
          throw new Error(`gateway: upgrade failed (${res.status})`);
        res.webSocket.accept();
        return res.webSocket;
      },
      onDm: (m) =>
        discordDm(env, deps, m).then(
          (r) => console.log("[gateway] dm", m.id, r),
          (e) => console.error("[gateway] dm failed:", m.id, e.message)
        ),
    });
  }

  async fetch(request) {
    if (new URL(request.url).pathname === "/ensure")
      await this.core
        .ensure(this.env.DISCORD_GATEWAY)
        .catch((e) => console.error("[gateway] connect failed:", e.message));
    await this.core.load();
    return Response.json({
      ...this.core.status(),
      mode: this.env.DISCORD_GATEWAY || "off",
    });
  }
}

// Worker side. ensure: from the per-minute cron. status: for /health; never throws.
export function gatewayClient(env) {
  const stub = () => env.DISCORD_GW.get(env.DISCORD_GW.idFromName("main"));
  return {
    ensure: () =>
      stub()
        .fetch("https://gw/ensure")
        .then((r) => r.json()),
    status: () =>
      stub()
        .fetch("https://gw/status")
        .then((r) => r.json())
        .catch((e) => ({ connected: false, error: e.message })),
  };
}
