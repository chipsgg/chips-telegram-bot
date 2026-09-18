/**
 * Uptime watchdog, run from the Worker's cron trigger (wrangler.toml [triggers]).
 *
 * Fetches the public /health of the configured host, compares against the last known state
 * (kept in the feed DO storage so it survives isolates) and sends ONE Telegram message on each
 * transition: healthy -> down, and down -> healthy again. Nothing while state is unchanged, so
 * a long outage is one message, not one every minute.
 *
 * Env:
 *   ALERT_TELEGRAM_CHAT   chat id that receives alerts (Jacob's DM). Empty = watchdog off.
 *   PUBLIC_HOST           hostname to probe (bot.chips.gg / bot-cf.chips.gg)
 * Uses the bot's own TELEGRAM_TOKEN to send.
 */
import { postTelegramChat } from "../platform/telegram.js";

export function classify(status, body) {
  if (status === 200 && body?.ok === true) return { up: true, reason: null };
  const problems = Array.isArray(body?.problems) ? body.problems : [];
  return {
    up: false,
    reason: problems.length
      ? problems.join("; ")
      : `HTTP ${status}${body?.status ? ` (${body.status})` : ""}`,
  };
}

export const DOWN_CONFIRMATIONS = 2;

/**
 * prev: { up: bool, since: ms, fails: n } | null
 * Going down needs DOWN_CONFIRMATIONS consecutive failed probes (a redeploy's cold Durable
 * Object reports degraded for about a second). Recovery fires on the first healthy probe.
 */
export function transition(prev, now) {
  if (!prev)
    return {
      fire: false,
      next: { up: now.up, since: Date.now(), fails: now.up ? 0 : 1 },
    };
  if (now.up) {
    if (prev.up) return { fire: false, next: { ...prev, fails: 0 } };
    return { fire: true, next: { up: true, since: Date.now(), fails: 0 } };
  }
  const fails = (prev.fails || 0) + 1;
  if (!prev.up) return { fire: false, next: { ...prev, fails } };
  if (fails < DOWN_CONFIRMATIONS)
    return { fire: false, next: { ...prev, fails } };
  return { fire: true, next: { up: false, since: Date.now(), fails } };
}

export function alertForm(host, now, prev, env) {
  const downFor = prev?.since
    ? Math.round((Date.now() - prev.since) / 60_000)
    : null;
  return now.up
    ? {
        emoji: "✅",
        title: "Bot recovered",
        content: `${host} is healthy again${downFor != null ? ` after ~${downFor} min` : ""}.`,
        url: `https://${host}/health`,
        buttonLabel: "Health",
      }
    : {
        emoji: "🚨",
        title: "Bot unhealthy",
        content: `${host}: ${now.reason}\nenv ${env.ENVIRONMENT || "?"} · ${env.VERSION || "?"}`,
        url: `https://${host}/health`,
        buttonLabel: "Health",
      };
}

export async function runWatchdog({ env, storage, fetchImpl = fetch }) {
  const chat = env.ALERT_TELEGRAM_CHAT;
  const host = env.PUBLIC_HOST;
  if (!chat || !host) return { skipped: "unconfigured" };
  let status = 0;
  let body = null;
  try {
    const res = await fetchImpl(`https://${host}/health`, {
      signal: AbortSignal.timeout(15_000),
    });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch (err) {
    status = 0;
    body = { problems: [`fetch failed: ${err.message}`] };
  }
  const now = classify(status, body);
  const prev = (await storage.get("watchdog")) || null;
  const t = transition(prev, now);
  await storage.put("watchdog", t.next);
  if (t.fire) {
    await postTelegramChat(env, chat, alertForm(host, now, prev, env));
    console.log(
      `[watchdog] ${host} ${now.up ? "recovered" : `DOWN: ${now.reason}`}`
    );
  }
  return { up: now.up, reason: now.reason, fired: t.fire };
}
