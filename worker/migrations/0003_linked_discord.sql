-- Discord users who linked a Chips account through the bot (or were discovered linked on a
-- command). Drives the daily VIP-role sync; the Chips API has no "list linked platforms".
CREATE TABLE IF NOT EXISTS linked_discord (
  discord_id   TEXT PRIMARY KEY,
  chips_userid TEXT NOT NULL,
  username     TEXT,
  rank         TEXT,              -- last rank we saw ("Collector III")
  role_id      TEXT,              -- last Discord role we put on them
  linked_at    INTEGER NOT NULL,
  synced_at    INTEGER
);
