/**
 * Usage metrics. Same metric names as the original Node bot so the landing page
 * numbers carried over the migration.
 *
 *   bot_metrics(metric_name TEXT PRIMARY KEY, metric_value INTEGER NOT NULL DEFAULT 0, updated_at INTEGER)
 *
 * Backends share one interface { track(platform), read() }:
 *   d1Metrics(env.DB)        Cloudflare D1 (migrations/0001_metrics.sql)
 *   sqliteMetrics(db)        node:sqlite DatabaseSync (adapters/node.js)
 *   memoryMetrics()          fallback when either is given a null handle
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
export const SCHEMA_SQL =
  "CREATE TABLE IF NOT EXISTS bot_metrics (metric_name TEXT PRIMARY KEY, metric_value INTEGER NOT NULL DEFAULT 0, updated_at INTEGER)";
const UPSERT_SQL =
  "INSERT INTO bot_metrics (metric_name, metric_value, updated_at) VALUES (?1, 1, ?2) ON CONFLICT(metric_name) DO UPDATE SET metric_value = metric_value + 1, updated_at = ?2";
const READ_SQL = "SELECT metric_name, metric_value FROM bot_metrics";

const zeroed = () => Object.fromEntries(METRIC_NAMES.map((n) => [n, 0]));
const namesFor = (platform) =>
  ["commands_executed", "messages_sent", PLATFORM_METRIC[platform]].filter(
    Boolean
  );

export function memoryMetrics() {
  const counts = zeroed();
  return {
    track: async (platform) => {
      for (const n of namesFor(platform)) counts[n] += 1;
    },
    read: async () => ({ ...counts }),
  };
}

export function d1Metrics(db) {
  if (!db) return memoryMetrics();
  return {
    track: async (platform) => {
      try {
        const stmt = db.prepare(UPSERT_SQL);
        const now = Date.now();
        await db.batch(namesFor(platform).map((n) => stmt.bind(n, now)));
      } catch (err) {
        console.error("[metrics] track failed:", err.message);
      }
    },
    read: async () => {
      try {
        const { results } = await db.prepare(READ_SQL).all();
        const out = zeroed();
        for (const r of results) out[r.metric_name] = Number(r.metric_value);
        return out;
      } catch (err) {
        console.error("[metrics] read failed:", err.message);
        return zeroed();
      }
    },
  };
}

export function sqliteMetrics(db) {
  if (!db) return memoryMetrics();
  db.exec(SCHEMA_SQL);
  const upsert = db.prepare(UPSERT_SQL);
  const read = db.prepare(READ_SQL);
  return {
    track: async (platform) => {
      try {
        const now = Date.now();
        for (const n of namesFor(platform)) upsert.run(n, now);
      } catch (err) {
        console.error("[metrics] track failed:", err.message);
      }
    },
    read: async () => {
      try {
        const out = zeroed();
        for (const r of read.all()) out[r.metric_name] = Number(r.metric_value);
        return out;
      } catch (err) {
        console.error("[metrics] read failed:", err.message);
        return zeroed();
      }
    },
  };
}
