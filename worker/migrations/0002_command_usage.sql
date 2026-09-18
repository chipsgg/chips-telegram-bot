-- Per-command usage, bucketed by UTC day. Answers "which of the 19 commands does anyone use?"
-- Failures are counted too (ok = 0) so a command that always errors shows up as such.
CREATE TABLE IF NOT EXISTS command_usage (
  day       TEXT    NOT NULL,          -- YYYY-MM-DD (UTC)
  platform  TEXT    NOT NULL,          -- discord | telegram | api
  command   TEXT    NOT NULL,
  ok        INTEGER NOT NULL DEFAULT 1,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, platform, command, ok)
);
CREATE INDEX IF NOT EXISTS command_usage_command ON command_usage (command, day);
