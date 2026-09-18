CREATE TABLE IF NOT EXISTS bot_metrics (
  metric_name  TEXT PRIMARY KEY,
  metric_value INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER
);
INSERT OR IGNORE INTO bot_metrics (metric_name, metric_value) VALUES
  ('messages_sent', 0),
  ('commands_executed', 0),
  ('discord_commands', 0),
  ('telegram_commands', 0),
  ('api_commands', 0);
