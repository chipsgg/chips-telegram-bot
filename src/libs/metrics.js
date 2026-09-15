/**
 * Bot Usage Metrics
 * Tracks commands executed, messages sent, and per-platform command counts.
 *
 * Storage is PostgreSQL when DATABASE_URL is set; otherwise an in-memory
 * store so the bot runs cleanly (no pool errors, no `null` connection
 * attempts) on a laptop or a container without a database. The public
 * interface is identical either way.
 */
const METRIC_NAMES = [
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

const zeroed = () => Object.fromEntries(METRIC_NAMES.map((name) => [name, 0]));

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

function memoryBackend() {
  const store = zeroed();
  return {
    kind: "memory",
    init: async () => undefined,
    increment: async (name, amount) => {
      store[name] = (store[name] || 0) + amount;
    },
    getAll: async () => ({ ...store }),
    close: async () => undefined,
  };
}

function postgresBackend(connectionString) {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", (err) => {
    console.error("[metrics] pool error:", err.message);
  });

  return {
    kind: "postgres",
    pool,
    init: async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS bot_metrics (
           metric_name  TEXT PRIMARY KEY,
           metric_value BIGINT NOT NULL DEFAULT 0,
           updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      );
      for (const name of METRIC_NAMES) {
        await pool.query(
          `INSERT INTO bot_metrics (metric_name, metric_value)
           VALUES ($1, 0) ON CONFLICT (metric_name) DO NOTHING`,
          [name]
        );
      }
    },
    increment: async (name, amount) => {
      await pool.query(
        `UPDATE bot_metrics
         SET metric_value = metric_value + $1, updated_at = NOW()
         WHERE metric_name = $2`,
        [amount, name]
      );
    },
    getAll: async () => {
      const { rows } = await pool.query(
        "SELECT metric_name, metric_value FROM bot_metrics"
      );
      const out = zeroed();
      for (const row of rows) out[row.metric_name] = Number(row.metric_value);
      return out;
    },
    close: () => pool.end(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const backend = process.env.DATABASE_URL
  ? postgresBackend(process.env.DATABASE_URL)
  : memoryBackend();

const ready = backend
  .init()
  .then(() => console.log(`[metrics] ${backend.kind} store ready`))
  .catch((err) =>
    console.error(`[metrics] init failed (${backend.kind}):`, err.message)
  );

// Increment a named metric; never throws (metrics must not break commands).
async function incrementMetric(metricName, amount = 1) {
  if (!METRIC_NAMES.includes(metricName)) return;
  try {
    await ready;
    await backend.increment(metricName, amount);
  } catch (err) {
    console.error("[metrics] increment failed:", err.message);
  }
}

// Return all metrics; zeroes on failure so the landing page always renders.
async function getMetrics() {
  try {
    await ready;
    return await backend.getAll();
  } catch (err) {
    console.error("[metrics] read failed:", err.message);
    return zeroed();
  }
}

// One command executed on `platform` (also counts as one message sent).
async function trackCommand(platform) {
  await incrementMetric("commands_executed");
  await incrementMetric("messages_sent");
  const platformMetric = PLATFORM_METRIC[platform];
  if (platformMetric) await incrementMetric(platformMetric);
}

// Kept for callers that count non-command messages.
const trackMessage = () => incrementMetric("messages_sent");

module.exports = {
  METRIC_NAMES,
  incrementMetric,
  getMetrics,
  trackCommand,
  trackMessage,
  close: () => backend.close(),
  backendKind: backend.kind,
};
