/**
 * Proactive announcements: turn feed state changes into messages for configured channels.
 *
 * Pure detection lives here (testable). Delivery goes through `send`, which the runtime
 * wires to Discord's channel-message endpoint and Telegram's sendMessage.
 *
 * Big wins: a row in stats.bets.bigwins we have not announced before, with winnings above
 * BROADCAST_MIN_USD or multiplier above BROADCAST_MIN_MULTIPLIER. The leaderboard holds ~25
 * rows and churns slowly, so "new row id" is a reliable "new event" signal. Seen ids are
 * persisted (bounded) so a redeploy does not re-announce the whole board.
 *
 * Config (env):
 *   BROADCAST_DISCORD_CHANNELS   comma-separated channel ids     (bot needs Send Messages + Embed Links)
 *   BROADCAST_TELEGRAM_CHATS     comma-separated chat ids        (bot must be a member / admin in channels)
 *   BROADCAST_MIN_USD            default 1000
 *   BROADCAST_MIN_MULTIPLIER     default 500
 *   BROADCAST_MAX_PER_FLUSH      default 3   (never spam a channel after a reconnect)
 */
import { postDiscordChannel } from "../platform/discord-rest.js";
import { postTelegramChat } from "../platform/telegram.js";
import { formatNumber, formatPrice, toUsd } from "./format.js";

export const SEEN_CAP = 500;

export function broadcastConfig(env = {}) {
  const list = (v) =>
    String(v || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return {
    discordChannels: list(env.BROADCAST_DISCORD_CHANNELS),
    telegramChats: list(env.BROADCAST_TELEGRAM_CHATS),
    minUsd: Number(env.BROADCAST_MIN_USD) || 1000,
    minMultiplier: Number(env.BROADCAST_MIN_MULTIPLIER) || 500,
    maxPerFlush: Number(env.BROADCAST_MAX_PER_FLUSH) || 3,
  };
}

export const isBroadcastEnabled = (cfg) =>
  cfg.discordChannels.length + cfg.telegramChats.length > 0;

/**
 * Pick rows worth announcing. `seen` is a Set of bet ids already announced; on a cold start
 * (empty set) the current board is swallowed silently so a deploy never re-posts history.
 * Returns { events, seen } with the updated set.
 */
export function detectBigWins(rows, currencies, seen, cfg) {
  const all = Object.values(rows || {}).filter(
    (r) => r?.bet?.id && r.bet.done && r.bet.win && r.player?.username
  );
  if (seen.size === 0) {
    return { events: [], seen: new Set(all.map((r) => r.bet.id)) };
  }
  const fresh = all.filter((r) => !seen.has(r.bet.id));
  const next = new Set(seen);
  for (const r of fresh) next.add(r.bet.id);
  const events = fresh
    .map((r) => {
      const cur = currencies?.[r.bet.currency];
      return {
        kind: "bigwin",
        betId: r.bet.id,
        username: r.player.username,
        game: r.game?.title || r.bet.slotname || r.bet.gamename || "a game",
        gameSlug: r.game?.slug || null,
        amountUsd: toUsd(r.bet.amount, cur),
        winningsUsd: toUsd(r.bet.winnings, cur),
        multiplier: Number(r.bet.multiplier) || 0,
        at: Number(r.bet.updated || r.created) || Date.now(),
      };
    })
    .filter(
      (e) => e.winningsUsd >= cfg.minUsd || e.multiplier >= cfg.minMultiplier
    )
    .sort((a, b) => b.winningsUsd - a.winningsUsd)
    .slice(0, cfg.maxPerFlush);
  return { events, seen: trimSeen(next) };
}

// keep the set bounded; drop the oldest inserted ids (Set preserves insertion order)
export function trimSeen(set) {
  if (set.size <= SEEN_CAP) return set;
  const arr = [...set];
  return new Set(arr.slice(arr.length - SEEN_CAP));
}

// One form per event, in the same shape commands use (discordMakeForm / telegramMakeForm)
export function bigWinForm(e) {
  const playerUrl = `https://chips.gg/user/${encodeURIComponent(e.username)}`;
  const gameUrl = e.gameSlug
    ? `https://chips.gg/play/${e.gameSlug}`
    : "https://chips.gg/casino";
  return {
    emoji: "💥",
    title: "Big Win",
    content:
      `**${e.username}** just turned ${formatPrice(e.amountUsd)} into **${formatPrice(e.winningsUsd)}**` +
      ` (${formatNumber(e.multiplier)}x) on ${e.game}.`,
    url: gameUrl,
    buttonLabel: "Play it",
    links: { player: playerUrl, game: gameUrl },
  };
}

// Deliver one form to every configured target. Returns { discord: n, telegram: n } sent.
export async function deliver(env, cfg, form) {
  const results = await Promise.all([
    ...cfg.discordChannels.map((id) => postDiscordChannel(env, id, form)),
    ...cfg.telegramChats.map((id) => postTelegramChat(env, id, form)),
  ]);
  const d = cfg.discordChannels.length;
  return {
    discord: results.slice(0, d).filter(Boolean).length,
    telegram: results.slice(d).filter(Boolean).length,
  };
}

/**
 * Called by the feed owner after bigwins state changed. Loads the seen set from storage,
 * detects, delivers, persists. Never throws.
 */
export async function announceBigWins({ env, storage, rows, currencies }) {
  const cfg = broadcastConfig(env);
  if (!isBroadcastEnabled(cfg)) return { events: 0 };
  try {
    const seen = new Set((await storage.get("bigwins_seen")) || []);
    const { events, seen: next } = detectBigWins(rows, currencies, seen, cfg);
    await storage.put("bigwins_seen", [...next]);
    let sent = { discord: 0, telegram: 0 };
    for (const e of events) {
      const r = await deliver(env, cfg, bigWinForm(e));
      sent = {
        discord: sent.discord + r.discord,
        telegram: sent.telegram + r.telegram,
      };
      console.log(
        `[broadcast] bigwin ${e.username} ${formatPrice(e.winningsUsd)} ${e.multiplier}x -> discord ${r.discord} telegram ${r.telegram}`
      );
    }
    return { events: events.length, sent };
  } catch (err) {
    console.error("[broadcast] failed:", err.message);
    return { events: 0, error: err.message };
  }
}
