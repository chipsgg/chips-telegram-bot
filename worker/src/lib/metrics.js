/**
 * Usage metrics.
 *
 * Two tables (migrations/0001, 0002):
 *   bot_metrics(metric_name PK, metric_value, updated_at)      lifetime totals; same names as
 *                                                              the original Node bot so the
 *                                                              landing page numbers carried over
 *   command_usage(day, platform, command, ok, count)           per-command, per-UTC-day, split
 *                                                              by success so "always fails" shows
 *
 * Backends share one interface:
 *   track(platform, command, ok = true)   count one execution
 *   read()                                lifetime totals (landing page)
 *   usage({ days = 30 })                  per-command rollup over the last N days
 *
 *   d1Metrics(env.DB)        Cloudflare D1
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

export const SCHEMA_SQL = [
  "CREATE TABLE IF NOT EXISTS bot_metrics (metric_name TEXT PRIMARY KEY, metric_value INTEGER NOT NULL DEFAULT 0, updated_at INTEGER)",
  "CREATE TABLE IF NOT EXISTS command_usage (day TEXT NOT NULL, platform TEXT NOT NULL, command TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 1, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, platform, command, ok))",
  "CREATE INDEX IF NOT EXISTS command_usage_command ON command_usage (command, day)",
];
const UPSERT_TOTAL_SQL =
  "INSERT INTO bot_metrics (metric_name, metric_value, updated_at) VALUES (?1, 1, ?2) ON CONFLICT(metric_name) DO UPDATE SET metric_value = metric_value + 1, updated_at = ?2";
const UPSERT_USAGE_SQL =
  "INSERT INTO command_usage (day, platform, command, ok, count) VALUES (?1, ?2, ?3, ?4, 1) ON CONFLICT(day, platform, command, ok) DO UPDATE SET count = count + 1";
const READ_TOTALS_SQL = "SELECT metric_name, metric_value FROM bot_metrics";
const READ_USAGE_SQL =
  "SELECT command, platform, ok, SUM(count) AS n FROM command_usage WHERE day >= ?1 GROUP BY command, platform, ok";

const zeroed = () => Object.fromEntries(METRIC_NAMES.map((n) => [n, 0]));
const namesFor = (platform) =>
  ["commands_executed", "messages_sent", PLATFORM_METRIC[platform]].filter(
    Boolean
  );
export const utcDay = (ms = Date.now()) =>
  new Date(ms).toISOString().slice(0, 10);
const sinceDay = (days) => utcDay(Date.now() - (days - 1) * 86_400_000);

// rows [{command, platform, ok, n}] -> { since, days, commands: { name: {total, ok, failed, byPlatform} } }
export function rollupUsage(rows, days) {
  const commands = {};
  for (const r of rows) {
    if (!commands[r.command])
      commands[r.command] = { total: 0, ok: 0, failed: 0, byPlatform: {} };
    const c = commands[r.command];
    const n = Number(r.n);
    c.total += n;
    if (Number(r.ok)) c.ok += n;
    else c.failed += n;
    c.byPlatform[r.platform] = (c.byPlatform[r.platform] || 0) + n;
  }
  const sorted = Object.fromEntries(
    Object.entries(commands).sort((a, b) => b[1].total - a[1].total)
  );
  return { since: sinceDay(days), days, commands: sorted };
}

export function memoryMetrics() {
  const counts = zeroed();
  const usage = new Map(); // key day|platform|command|ok -> n
  return {
    track: async (platform, command = "unknown", ok = true) => {
      for (const n of namesFor(platform)) counts[n] += 1;
      const k = `${utcDay()}|${platform}|${command}|${ok ? 1 : 0}`;
      usage.set(k, (usage.get(k) || 0) + 1);
    },
    read: async () => ({ ...counts }),
    usage: async ({ days = 30 } = {}) => {
      const since = sinceDay(days);
      const rows = [];
      for (const [k, n] of usage) {
        const [day, platform, command, ok] = k.split("|");
        if (day >= since) rows.push({ command, platform, ok: Number(ok), n });
      }
      return rollupUsage(rows, days);
    },
  };
}

export function d1Metrics(db) {
  if (!db) return memoryMetrics();
  return {
    track: async (platform, command = "unknown", ok = true) => {
      try {
        const total = db.prepare(UPSERT_TOTAL_SQL);
        const now = Date.now();
        await db.batch([
          ...namesFor(platform).map((n) => total.bind(n, now)),
          db
            .prepare(UPSERT_USAGE_SQL)
            .bind(utcDay(now), platform, command, ok ? 1 : 0),
        ]);
      } catch (err) {
        console.error("[metrics] track failed:", err.message);
      }
    },
    read: async () => {
      try {
        const { results } = await db.prepare(READ_TOTALS_SQL).all();
        const out = zeroed();
        for (const r of results) out[r.metric_name] = Number(r.metric_value);
        return out;
      } catch (err) {
        console.error("[metrics] read failed:", err.message);
        return zeroed();
      }
    },
    usage: async ({ days = 30 } = {}) => {
      try {
        const { results } = await db
          .prepare(READ_USAGE_SQL)
          .bind(sinceDay(days))
          .all();
        return rollupUsage(results, days);
      } catch (err) {
        console.error("[metrics] usage read failed:", err.message);
        return rollupUsage([], days);
      }
    },
  };
}

export function sqliteMetrics(db) {
  if (!db) return memoryMetrics();
  for (const sql of SCHEMA_SQL) db.exec(sql);
  const total = db.prepare(UPSERT_TOTAL_SQL);
  const usage = db.prepare(UPSERT_USAGE_SQL);
  const readTotals = db.prepare(READ_TOTALS_SQL);
  const readUsage = db.prepare(READ_USAGE_SQL);
  return {
    track: async (platform, command = "unknown", ok = true) => {
      try {
        const now = Date.now();
        for (const n of namesFor(platform)) total.run(n, now);
        usage.run(utcDay(now), platform, command, ok ? 1 : 0);
      } catch (err) {
        console.error("[metrics] track failed:", err.message);
      }
    },
    read: async () => {
      try {
        const out = zeroed();
        for (const r of readTotals.all())
          out[r.metric_name] = Number(r.metric_value);
        return out;
      } catch (err) {
        console.error("[metrics] read failed:", err.message);
        return zeroed();
      }
    },
    usage: async ({ days = 30 } = {}) => {
      try {
        return rollupUsage(readUsage.all(sinceDay(days)), days);
      } catch (err) {
        console.error("[metrics] usage read failed:", err.message);
        return rollupUsage([], days);
      }
    },
  };
}
