/**
 * Linked-account lookups for the support inbox: platform id -> Chips uid.
 *
 * auth/getUserByPlatformID is the source of truth but refuses a second call within ~1.6 s per
 * IP, so hits are cached (spec §9b: hits may be cached, misses never). Telegram hits live in
 * linked_telegram (migration 0004, written here and on /linkaccount). Discord reads
 * linked_discord but never writes it: that table belongs to the role sync (lib/rolesync.js).
 *
 * Backends: D1, or memory when there is no handle (tests, the Node adapter, which has no inbox).
 * A hit is trusted for LINK_TTL_MS from the API's last yes (linked_at, both tables), then the API is asked again: chips.gg
 * unlinks (an account-takeover cleanup) must reach the inbox. A Telegram row the API no longer links is deleted; a Discord
 * one is left to rolesync, whose table it is, and stays stale, so every message asks again and is refused.
 */
import { linkedAccount } from "../commands/identity.js";

const GET_SQL = {
  telegram:
    "SELECT chips_userid, username, linked_at AS at FROM linked_telegram WHERE telegram_id = ?1",
  discord:
    "SELECT chips_userid, username, linked_at AS at FROM linked_discord WHERE discord_id = ?1",
};
// linked_discord is rolesync's (it inserts); the inbox only refreshes linked_at on a row it has, after the API said yes.
// synced_at can't date a hit: the role sync re-reads the player, never the link.
const PUT_DISCORD_SQL =
  "UPDATE linked_discord SET chips_userid = ?2, username = COALESCE(?3, username), linked_at = ?4 WHERE discord_id = ?1";
const DEL_SQL = "DELETE FROM linked_telegram WHERE telegram_id = ?1";
export const LINK_TTL_MS = 24 * 3600_000;
const PUT_SQL =
  "INSERT INTO linked_telegram (telegram_id, chips_userid, username, linked_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(telegram_id) DO UPDATE SET chips_userid = ?2, username = ?3, linked_at = ?4";

export function memoryLinks() {
  const rows = new Map();
  return {
    get: async (platform, id) => rows.get(`${platform}:${id}`) ?? null,
    put: async (platform, id, uid, username, at = Date.now()) => {
      rows.set(`${platform}:${id}`, { uid, username: username ?? null, at });
    },
    del: async (platform, id) => {
      rows.delete(`${platform}:${id}`);
    },
  };
}

export function d1Links(db) {
  if (!db) return memoryLinks();
  return {
    get: async (platform, id) => {
      const r = await db
        .prepare(GET_SQL[platform])
        .bind(String(id))
        .first()
        .catch((err) => console.error("[links] get failed:", err.message));
      return r ? { uid: r.chips_userid, username: r.username, at: r.at } : null;
    },
    put: async (platform, id, uid, username, at = Date.now()) => {
      await db
        .prepare(platform === "telegram" ? PUT_SQL : PUT_DISCORD_SQL)
        .bind(String(id), uid, username ?? null, at)
        .run()
        .catch((err) => console.error("[links] put failed:", err.message));
    },
    del: async (platform, id) => {
      if (platform !== "telegram") return;
      await db
        .prepare(DEL_SQL)
        .bind(String(id))
        .run()
        .catch((err) => console.error("[links] del failed:", err.message));
    },
  };
}

// The API's per-IP floor, honoured per isolate. State sits on the clock so tests bring their own.
const FLOOR_MS = 1600;
export const isolateClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  next: 0,
};

/**
 * {uid, username} for a linked platform user, or null. Throws when the API errors. maxAge 0 always asks the API (a
 * sign-in that mints a long session must not ride a cached link).
 */
export async function resolveLink(
  deps,
  platform,
  id,
  clock = isolateClock,
  maxAge = LINK_TTL_MS
) {
  const hit = await deps.links?.get(platform, id);
  if (hit && clock.now() - (hit.at ?? 0) < maxAge)
    return { uid: hit.uid, username: hit.username };
  const now = clock.now();
  const at = Math.max(now, clock.next);
  clock.next = at + FLOOR_MS; // reserve the slot before waiting, so concurrent calls queue
  if (at > now) await clock.sleep(at - now);
  const user = await linkedAccount(deps.api, { platform, userid: id });
  if (!user) {
    if (hit) await deps.links?.del?.(platform, id);
    return null;
  }
  await deps.links?.put(platform, id, user.id, user.username, clock.now());
  return { uid: user.id, username: user.username ?? null };
}
