/**
 * Usage metrics in D1. Schema (created by migrations/0001_metrics.sql):
 *   bot_metrics(metric_name TEXT PRIMARY KEY, metric_value INTEGER NOT NULL DEFAULT 0, updated_at INTEGER)
 * Same metric names as the Node version so the landing page numbers carry over.
 */
export const METRIC_NAMES = [
  "messages_sent",
  "commands_executed",
  "discord_commands",
  "telegram_commands",
  "api_commands",
];
const PLATFORM_METRIC = {
  discord: "discord_commands",
  telegram: "telegram_commands",
  api: "api_commands",
};

const zeroed = () => Object.fromEntries(METRIC_NAMES.map((n) => [n, 0]));

export async function track(env, platform) {
  if (!env.DB) return;
  const names = [
    "commands_executed",
    "messages_sent",
    PLATFORM_METRIC[platform],
  ].filter(Boolean);
  try {
    const stmt = env.DB.prepare(
      "INSERT INTO bot_metrics (metric_name, metric_value, updated_at) VALUES (?1, 1, ?2) ON CONFLICT(metric_name) DO UPDATE SET metric_value = metric_value + 1, updated_at = ?2"
    );
    const now = Date.now();
    await env.DB.batch(names.map((n) => stmt.bind(n, now)));
  } catch (err) {
    console.error("[metrics] track failed:", err.message);
  }
}

export async function getMetrics(env) {
  if (!env.DB) return zeroed();
  try {
    const { results } = await env.DB.prepare(
      "SELECT metric_name, metric_value FROM bot_metrics"
    ).all();
    const out = zeroed();
    for (const r of results) out[r.metric_name] = Number(r.metric_value);
    return out;
  } catch (err) {
    console.error("[metrics] read failed:", err.message);
    return zeroed();
  }
}
