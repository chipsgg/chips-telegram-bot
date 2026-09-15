/**
 * Chips.gg WebSocket SDK Client
 * One persistent WebSocket to the Chips.gg API. Exposes `actions.<channel>(method, params)`
 * plus a small state cache fed by the realtime subscriptions (prices, bigwins, luckiest,
 * profitshare). Read-only by design: nothing here writes to a player wallet or chat.
 */
const WS = require("ws");
const Client = require("@chipsgg/openservice-ws-client");
const lodash = require("lodash");

const HOST = process.env.CHIPS_WS_HOST || "wss://api.chips.gg/prod/socket";

// Channels the bot actually calls. `backoffice` is only reachable when CHIPS_TOKEN
// belongs to a staff account; public-only deployments still work without it.
const CHANNELS = [
  "public",
  "auth",
  "private",
  "affiliates",
  "stats",
  "profitshare",
  "community",
  "backoffice",
];

// Realtime feeds kept warm in `state`
const SUBSCRIPTIONS = [
  ["profitshare", { name: "profitshareInfo" }],
  ["profitshare", { name: "profitshareBalance" }],
  ["stats", { game: "bets", type: "recentBets" }],
  ["stats", { game: "bets", type: "luckiest" }],
  ["stats", { game: "bets", type: "bigwins" }],
];

const noop = () => undefined;

module.exports = async (CHIPS_TOKEN, emit = noop) => {
  let state = {};
  let authed = { userid: null, tokenid: null };

  // Authenticate with the operator token. If none is configured, or it is rejected,
  // fall back ONCE to an anonymous server-issued token (public channels only).
  async function authenticate(actions) {
    if (CHIPS_TOKEN) {
      try {
        const userid = await actions.auth("authenticate", CHIPS_TOKEN);
        return { userid, tokenid: CHIPS_TOKEN, anonymous: false };
      } catch (err) {
        console.error(
          "[sdk] CHIPS_TOKEN rejected, continuing anonymously:",
          err.message
        );
      }
    }
    const tokenid = await actions.auth("token");
    await actions.auth("authenticate", tokenid);
    return { userid: null, tokenid, anonymous: true };
  }

  const subscribe = (actions) => {
    for (const [channel, params] of SUBSCRIPTIONS) {
      actions[channel]("on", params).catch(noop);
    }
  };

  const { actions } = await Client(
    WS,
    {
      host: HOST,
      channels: CHANNELS,
      keepAlive: 1000,
      wsOptions: {
        handshakeTimeout: 10000,
        maxRetries: 5,
        onError: (err) =>
          console.error("[sdk] websocket error:", err.message || err),
      },
    },
    async (type, newState) => {
      switch (type) {
        case "change": {
          state = { ...state, ...newState };
          emit("change", state);
          break;
        }
        case "open": {
          console.log("[sdk] connected");
          break;
        }
        case "close": {
          console.log("[sdk] disconnected");
          break;
        }
        case "reconnect": {
          console.log("[sdk] reconnected, re-authenticating");
          try {
            authed = await authenticate(actions);
            subscribe(actions);
          } catch (err) {
            console.error("[sdk] re-auth failed:", err.message);
          }
          break;
        }
        default:
          break;
      }
    }
  );

  authed = await authenticate(actions);
  if (authed.anonymous) {
    console.warn(
      "[sdk] running anonymously: staff commands (/affiliate) will be unavailable"
    );
  } else {
    const me = await actions.private("me");
    console.log(`[sdk] authenticated as ${me.username} (${me.id})`);
  }

  // Subscribe now and re-assert periodically (the server drops idle subscriptions)
  subscribe(actions);
  const resub = setInterval(() => subscribe(actions), 30 * 1000);
  resub.unref?.();

  // Random slot from the most-played list (used by /slotcall)
  async function getRandomSlot() {
    const slots = await actions.public("listGamesMostPlayed", {
      skip: 0,
      limit: 100,
    });
    const pool = (slots || []).filter(
      (x) => Array.isArray(x.tags) && x.tags.includes("slots")
    );
    return lodash.sample(pool.length ? pool : slots);
  }

  return {
    _actions: actions,
    state: () => state,
    get: (...path) => lodash.get(state, path),
    isAnonymous: () => authed.anonymous,
    getRandomSlot,
    getUserByPlatformID: (platform, platformid) =>
      actions.auth("getUserByPlatformID", { platformid, platform }),
  };
};
