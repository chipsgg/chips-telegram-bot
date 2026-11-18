-- Telegram users known to be linked to a Chips account (on /linkaccount, or a successful
-- auth/getUserByPlatformID lookup; never a miss). Cache for the support inbox and the Mini App
-- initData check, so a player message does not wait on the API's ~1.6 s per-IP floor.
CREATE TABLE IF NOT EXISTS linked_telegram (
  telegram_id  TEXT PRIMARY KEY,
  chips_userid TEXT NOT NULL,
  username     TEXT,
  linked_at    INTEGER NOT NULL
);
