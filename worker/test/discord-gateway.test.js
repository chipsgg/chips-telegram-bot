// Discord gateway in a Durable Object (platform/discord-gateway.js): identify, heartbeat, resume
// across a restart (deploy), Discord's reconnect/invalid-session ops, fatal closes, DM-only
// dispatch, shadow vs on, and the /health line. A fake socket and manual timers stand in.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHealth } from "../src/lib/health.js";
import { GATEWAY_URL, GatewayCore } from "../src/platform/discord-gateway.js";

function memStorage() {
  const m = new Map();
  return {
    m,
    get: async (k) => structuredClone(m.get(k)),
    put: async (k, v) => void m.set(k, structuredClone(v)),
  };
}

function rig({ storage = memStorage(), t0 = 1_000_000 } = {}) {
  const sockets = [];
  const timers = [];
  const dms = [];
  const clock = { t: t0 };
  const core = new GatewayCore({
    token: "TKN",
    storage,
    onDm: (m) => dms.push(m),
    now: () => clock.t,
    setTimer: (fn, ms) => {
      const h = { fn, ms };
      timers.push(h);
      return h;
    },
    clearTimer: (h) => {
      h.cleared = true;
    },
    openSocket: async (url) => {
      const ls = {};
      const ws = {
        url,
        readyState: 1,
        sent: [],
        closed: null,
        send: (s) => ws.sent.push(JSON.parse(s)),
        close: (code) => {
          ws.closed = code;
        },
        addEventListener: (ev, fn) => {
          ls[ev] = fn;
        },
        emit: (ev, data) => ls[ev]?.(data),
      };
      sockets.push(ws);
      return ws;
    },
  });
  const push = (_ws, p) => core.onMessage(JSON.stringify(p));
  const fire = async () => {
    const live = timers.filter((h) => !h.cleared && !h.done);
    for (const h of live) {
      h.done = true;
      await h.fn();
    }
  };
  return { core, sockets, timers, dms, clock, storage, push, fire };
}

const hello = { op: 10, d: { heartbeat_interval: 41250 } };
const ready = (s = 1) => ({
  op: 0,
  s,
  t: "READY",
  d: { session_id: "sess1", resume_gateway_url: "wss://resume.discord.gg" },
});
const dm = (s, id, extra = {}) => ({
  op: 0,
  s,
  t: "MESSAGE_CREATE",
  d: { id, channel_id: "c1", author: { id: "u1" }, ...extra },
});

test("first connect identifies with only the DM intent, then files DMs when on", async () => {
  const r = rig();
  await r.core.ensure("on");
  const ws = r.sockets[0];
  assert.equal(ws.url, `${GATEWAY_URL}/?v=10&encoding=json`);
  await r.push(ws, hello);
  assert.deepEqual(ws.sent[0], {
    op: 2,
    d: {
      token: "TKN",
      intents: 4096,
      properties: { os: "linux", browser: "chips-bot", device: "chips-bot" },
    },
  });
  await r.push(ws, ready(1));
  await r.push(ws, dm(2, "m1"));
  await r.push(ws, dm(3, "m2", { guild_id: "g1" })); // guild message: never ours
  await r.push(ws, dm(4, "m3", { author: { id: "b", bot: true } })); // bots ignored
  assert.deepEqual(r.dms, [{ channel_id: "c1", id: "m1" }]);
  const st = r.core.status();
  assert.equal(st.connected, true);
  assert.equal(st.dms, 1);
  assert.equal(st.identifies, 1);
  assert.deepEqual(r.storage.m.get("gateway"), {
    lastIdentify: 1_000_000,
    id: "sess1",
    resumeUrl: "wss://resume.discord.gg",
    seq: 4,
  });
});

test("shadow counts DMs but does not act on them", async () => {
  const r = rig();
  await r.core.ensure("shadow");
  await r.push(r.sockets[0], hello);
  await r.push(r.sockets[0], ready());
  await r.push(r.sockets[0], dm(2, "m1"));
  assert.equal(r.dms.length, 0);
  assert.equal(r.core.status().dms, 1);
});

test("a restarted DO (deploy) resumes from storage instead of identifying", async () => {
  const a = rig();
  await a.core.ensure("on");
  await a.push(a.sockets[0], hello);
  await a.push(a.sockets[0], ready(1));
  await a.push(a.sockets[0], dm(7, "m1"));
  const b = rig({ storage: a.storage, t0: 1_030_000 }); // 30 s later, fresh memory
  await b.core.ensure("on");
  const ws = b.sockets[0];
  assert.equal(ws.url, "wss://resume.discord.gg/?v=10&encoding=json");
  await b.push(ws, hello);
  assert.deepEqual(ws.sent[0], {
    op: 6,
    d: { token: "TKN", session_id: "sess1", seq: 7 },
  });
  await b.push(ws, { op: 0, s: 8, t: "RESUMED", d: {} });
  await b.push(ws, dm(9, "missed")); // Discord replays what arrived while we were down
  assert.deepEqual(b.dms, [{ channel_id: "c1", id: "missed" }]);
  assert.equal(b.core.status().resumes, 1);
  assert.equal(b.core.status().identifies, 0);
});

test("heartbeat sends seq; a missing ACK drops the zombie socket and resumes", async () => {
  const r = rig();
  await r.core.ensure("on");
  const ws = r.sockets[0];
  await r.push(ws, hello);
  await r.push(ws, ready(5));
  await r.fire(); // first beat
  assert.deepEqual(ws.sent.at(-1), { op: 1, d: 5 });
  await r.push(ws, { op: 11 });
  assert.equal(r.core.status().lastAckAgoSec, 0);
  await r.fire(); // second beat, acked: fine
  assert.equal(ws.closed, null);
  await r.fire(); // third beat, no ACK since the second: zombie
  assert.equal(ws.closed, 4000);
  await r.fire(); // reconnect timer
  assert.equal(r.sockets[1].url, "wss://resume.discord.gg/?v=10&encoding=json");
});

test("op 7 reconnect resumes; op 9 not-resumable clears the session", async () => {
  const r = rig();
  await r.core.ensure("on");
  await r.push(r.sockets[0], hello);
  await r.push(r.sockets[0], ready());
  await r.push(r.sockets[0], { op: 7, d: null });
  assert.equal(r.sockets[0].closed, 4000);
  assert.equal(r.storage.m.get("gateway").id, "sess1");
  await r.fire();
  await r.push(r.sockets[1], { op: 9, d: false });
  assert.equal(r.storage.m.get("gateway").id, undefined);
  r.clock.t += 121_000; // past the identify throttle
  await r.fire();
  await r.push(r.sockets[2], hello);
  assert.equal(r.sockets[2].sent[0].op, 2);
});

test("identify is throttled so a flapping socket cannot burn Discord's daily limit", async () => {
  const r = rig();
  await r.core.ensure("on");
  await r.push(r.sockets[0], hello); // identify, no READY yet
  await r.sockets[0].emit("close", { code: 1006 });
  await r.fire();
  assert.equal(r.sockets.length, 1, "no second identify within 2 min");
  r.clock.t += 121_000;
  await r.core.ensure("on");
  assert.equal(r.sockets.length, 2);
});

test("a fatal close (bad token) stops reconnecting until the mode is turned off", async () => {
  const r = rig();
  await r.core.ensure("on");
  await r.push(r.sockets[0], hello);
  await r.sockets[0].emit("close", { code: 4004 });
  r.clock.t += 600_000;
  await r.fire();
  await r.core.ensure("on");
  assert.equal(r.sockets.length, 1);
  assert.equal(r.core.status().fatal, 4004);
  await r.core.ensure(undefined); // off clears it
  await r.core.ensure("on");
  assert.equal(r.sockets.length, 2);
});

test("turning it off closes with 1000 and forgets the session", async () => {
  const r = rig();
  await r.core.ensure("on");
  await r.push(r.sockets[0], hello);
  await r.push(r.sockets[0], ready());
  await r.core.ensure("off");
  assert.equal(r.sockets[0].closed, 1000);
  assert.deepEqual(r.storage.m.get("gateway"), {});
  assert.equal(r.core.status().connected, false);
});

test("/health: gateway DO counts against ok only when on", async () => {
  const feed = {
    status: async () => ({ connected: true, stale: false, activity: {} }),
  };
  const env = { CHIPS_API_HOST: "x" };
  const h = (gw) =>
    buildHealth({
      env,
      feed,
      host: "bot.test",
      gateway: { status: async () => gw },
    });
  const down = { connected: false, lastAckAgoSec: null, fatal: null };
  let r = await h({ ...down, mode: "shadow" });
  assert.equal(r.ok, true);
  assert.equal(r.discord.gatewayDo.mode, "shadow");
  r = await h({ ...down, mode: "on" });
  assert.equal(r.ok, false);
  assert.ok(
    r.problems.includes(
      "discord: gateway disconnected (plain DMs not arriving)"
    )
  );
  r = await h({ ...down, mode: "on", fatal: 4004 });
  assert.ok(
    r.problems.includes(
      "discord: gateway closed by Discord (4004) (plain DMs not arriving)"
    )
  );
  r = await h({ mode: "on", connected: true, lastAckAgoSec: 30 });
  assert.equal(r.ok, true);
  r = await h({
    mode: "on",
    connected: true,
    lastAckAgoSec: null,
    connectedAgoSec: 5,
  });
  assert.equal(r.ok, true, "just connected, first ACK not due yet");
});
