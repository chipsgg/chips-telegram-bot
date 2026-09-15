/**
 * PostgreSQL-backed Bot Usage Metrics
 * Tracks and persists bot activity metrics such as commands executed,
 * messages sent, and per-platform command counts (Discord, Telegram, API).
 */
const { Pool } = require("pg");

// Configure a small connection pool to the PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Database pool error:", err.message);
});

// Ensure all default metric rows exist in the database on startup
async function initMetrics() {
  const defaultMetrics = [
    "messages_sent",
    "commands_executed", 
    "discord_commands",
    "telegram_commands",
    "api_commands"
  ];
  
  try {
    for (const metric of defaultMetrics) {
      await pool.query(
        `INSERT INTO bot_metrics (metric_name, metric_value) 
         VALUES ($1, 0) 
         ON CONFLICT (metric_name) DO NOTHING`,
        [metric]
      );
    }
    console.log("Metrics initialized");
  } catch (error) {
    console.error("Error initializing metrics:", error.message);
  }
}

initMetrics();

// Atomically increment a named metric by the given amount
async function incrementMetric(metricName, amount = 1) {
  try {
    await pool.query(
      `UPDATE bot_metrics 
       SET metric_value = metric_value + $1, updated_at = NOW() 
       WHERE metric_name = $2`,
      [amount, metricName]
    );
  } catch (error) {
    console.error("Error incrementing metric:", error.message);
  }
}

// Retrieve all metrics as a key-value object; returns defaults on error
async function getMetrics() {
  try {
    const result = await pool.query("SELECT metric_name, metric_value FROM bot_metrics");
    const metrics = {};
    result.rows.forEach((row) => {
      metrics[row.metric_name] = parseInt(row.metric_value);
    });
    console.log("Metrics loaded:", metrics);
    return metrics;
  } catch (error) {
    console.error("Error getting metrics:", error.message, error.code);
    return {
      messages_sent: 0,
      commands_executed: 0,
      discord_commands: 0,
      telegram_commands: 0,
      api_commands: 0,
    };
  }
}

// Increment both the global and platform-specific command counters
async function trackCommand(platform) {
  await incrementMetric("commands_executed");
  if (platform === "discord") {
    await incrementMetric("discord_commands");
  } else if (platform === "telegram") {
    await incrementMetric("telegram_commands");
  } else if (platform === "api") {
    await incrementMetric("api_commands");
  }
}

// Increment the messages_sent counter
async function trackMessage() {
  await incrementMetric("messages_sent");
}

module.exports = {
  incrementMetric,
  getMetrics,
  trackCommand,
  trackMessage,
  pool,
};
