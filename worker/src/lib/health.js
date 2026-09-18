/**
 * /health assembly.
 *
 * Three layers, each answering a different question:
 *   feed      is the api.chips.gg websocket up and pushing?           (DO status)
 *   wiring    do Discord + Telegram actually point at THIS host?       (platform APIs, cached 60s)
 *   activity  when did each platform last deliver something we handled? (DO counters)
 *
 * `ok` = feed connected+fresh AND every configured platform is wired to this host.
 * Last-activity is informational: a quiet hour on Telegram is normal, a wrong webhook URL is not.
 */

const CACHE_TTL_MS = 60_000;
let wiringCache = { at: 0, host: null, value: null };

const ago = (ts) => (ts ? Math.round((Date.now() - ts) / 1000) : null);

async function telegramWiring(env, host) {
  if (!env.TELEGRAM_TOKEN) return { configured: false };
  try {
    const base = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}`;
    const [me, wh] = await Promise.all([
      fetch(`${base}/getMe`).then((r) => r.json()),
      fetch(`${base}/getWebhookInfo`).then((r) => r.json()),
    ]);
    const info = wh.result || {};
    const expected = `https://${host}/telegram`;
    return {
      configured: true,
      bot: me.result?.username ? `@${me.result.username}` : null,
      webhook: info.url || null,
      wired: info.url === expected,
      pending: info.pending_update_count ?? null,
      lastError: info.last_error_message
        ? {
            message: info.last_error_message,
            at: info.last_error_date ? info.last_error_date * 1000 : null,
          }
        : null,
    };
  } catch (err) {
    return { configured: true, wired: false, error: err.message };
  }
}

async function discordWiring(env, host) {
  if (!env.DISCORD_TOKEN) return { configured: false };
  try {
    const H = { authorization: `Bot ${env.DISCORD_TOKEN}` };
    const [app, guilds] = await Promise.all([
      fetch("https://discord.com/api/v10/applications/@me", {
        headers: H,
      }).then((r) => r.json()),
      fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: H,
      }).then((r) => r.json()),
    ]);
    const expected = `https://${host}/discord`;
    return {
      configured: true,
      app: app.name || null,
      applicationId: app.id || null,
      endpoint: app.interactions_endpoint_url || null,
      wired: app.interactions_endpoint_url === expected,
      guilds: Array.isArray(guilds) ? guilds.length : null,
      broadcast: await discordChannelAccess(env, H),
    };
  } catch (err) {
    return { configured: true, wired: false, error: err.message };
  }
}

// Can the bot see + post in each configured announcement channel? GET /channels/{id} needs
// View Channel; a 403/404 here means the first real big win would fail silently.
async function discordChannelAccess(env, H) {
  const ids = [
    ...new Set(
      `${env.BROADCAST_DISCORD_CHANNELS || ""},${env.PROMO_DISCORD_CHANNELS || ""}`
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    ),
  ];
  if (!ids.length) return null;
  const out = {};
  for (const id of ids) {
    try {
      const r = await fetch(`https://discord.com/api/v10/channels/${id}`, {
        headers: H,
      });
      const j = await r.json().catch(() => ({}));
      out[id] = r.ok
        ? { ok: true, name: j.name || null, guild: j.guild_id || null }
        : { ok: false, status: r.status, error: j.message || null };
    } catch (err) {
      out[id] = { ok: false, error: err.message };
    }
  }
  return out;
}

// Platform-API checks, memoised per host for CACHE_TTL_MS
async function wiring(env, host, fresh = false) {
  const now = Date.now();
  if (
    !fresh &&
    wiringCache.value &&
    wiringCache.host === host &&
    now - wiringCache.at < CACHE_TTL_MS
  ) {
    return wiringCache.value;
  }
  const [telegram, discord] = await Promise.all([
    telegramWiring(env, host),
    discordWiring(env, host),
  ]);
  wiringCache = { at: now, host, value: { telegram, discord } };
  return wiringCache.value;
}

export async function buildHealth({ env, feed, host, fresh = false }) {
  const [feedStatus, platforms] = await Promise.all([
    feed.status().catch((e) => ({ connected: false, error: e.message })),
    wiring(env, host, fresh),
  ]);

  const activity = feedStatus.activity || {};
  const platform = (name) => ({
    ...platforms[name],
    lastSeen: activity[name] || null,
    lastSeenAgoSec: ago(activity[name]),
    handled: activity[`${name}_count`] || 0,
  });

  const telegram = platform("telegram");
  const discord = platform("discord");

  const feedOk = Boolean(feedStatus.connected && !feedStatus.stale);
  const wiredOk = [telegram, discord].every((p) => !p.configured || p.wired);
  const ok = feedOk && wiredOk;

  const problems = [];
  if (!feedStatus.connected) problems.push("feed: websocket disconnected");
  else if (feedStatus.stale) problems.push("feed: no pushes for >5 min");
  if (telegram.configured && !telegram.wired)
    problems.push(
      `telegram: webhook is ${telegram.webhook || "unset"}, expected https://${host}/telegram`
    );
  if (telegram.lastError)
    problems.push(
      `telegram: last delivery error "${telegram.lastError.message}"`
    );
  for (const [id, c] of Object.entries(discord.broadcast || {}))
    if (!c.ok)
      problems.push(
        `discord: cannot access announcement channel ${id} (${c.status || c.error || "unknown"})`
      );
  if (discord.configured && !discord.wired)
    problems.push(
      `discord: interactions endpoint is ${discord.endpoint || "unset"}, expected https://${host}/discord`
    );

  const { activity: _a, ...feedRest } = feedStatus;
  return {
    ok,
    status: ok ? "healthy" : "degraded",
    problems,
    environment: env.ENVIRONMENT || "unknown",
    version: env.VERSION || "dev",
    commit: env.COMMIT || "unknown",
    builtAt: env.BUILT_AT || null,
    host,
    feed: feedRest,
    discord,
    telegram,
    api: {
      lastSeen: activity.api || null,
      lastSeenAgoSec: ago(activity.api),
      handled: activity.api_count || 0,
    },
  };
}
