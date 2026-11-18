/**
 * Linked-account lookups for the support inbox: platform id -> Chips uid.
 *
 * auth/getUserByPlatformID is the source of truth but refuses a second call within ~1.6 s per
 * IP, so hits are cached (spec §9b: hits may be cached, misses never). Telegram hits live in
 * linked_telegram (migration 0004, written here and on /linkaccount). Discord reads
 * linked_discord but never writes it: that table belongs to the role sync (lib/rolesync.js).
 *
 * Backends: D1, or memory when there is no handle (tests, the Node adapter, which has no inbox).
 * ponytail: hits never expire; /linkaccount overwrites. Add a TTL if chips.gg unlinks happen.
 */
import { linkedAccount } from "../commands/identity.js";

const GET_SQL = {
  telegram:
    "SELECT chips_userid, username FROM linked_telegram WHERE telegram_id = ?1",
  discord:
    "SELECT chips_userid, username FROM linked_discord WHERE discord_id = ?1",
};
const PUT_SQL =
  "INSERT INTO linked_telegram (telegram_id, chips_userid, username, linked_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(telegram_id) DO UPDATE SET chips_userid = ?2, username = ?3, linked_at = ?4";

export function memoryLinks() {
  const rows = new Map();
  return {
    get: async (platform, id) => rows.get(`${platform}:${id}`) ?? null,
    put: async (platform, id, uid, username) => {
      rows.set(`${platform}:${id}`, { uid, username: username ?? null });
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
      return r ? { uid: r.chips_userid, username: r.username } : null;
    },
    put: async (platform, id, uid, username) => {
      if (platform !== "telegram") return;
      await db
        .prepare(PUT_SQL)
        .bind(String(id), uid, username ?? null, Date.now())
        .run()
        .catch((err) => console.error("[links] put failed:", err.message));
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

/** {uid, username} for a linked platform user, or null. Throws when the API errors. */
export async function resolveLink(deps, platform, id, clock = isolateClock) {
  const hit = await deps.links?.get(platform, id);
  if (hit) return hit;
  const now = clock.now();
  const at = Math.max(now, clock.next);
  clock.next = at + FLOOR_MS; // reserve the slot before waiting, so concurrent calls queue
  if (at > now) await clock.sleep(at - now);
  const user = await linkedAccount(deps.api, { platform, userid: id });
  if (!user) return null;
  await deps.links?.put(platform, id, user.id, user.username);
  return { uid: user.id, username: user.username ?? null };
}
