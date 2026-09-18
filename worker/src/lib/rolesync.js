/**
 * VIP rank -> Discord role sync.
 *
 * The Chips API can resolve ONE platform id (auth/getUserByPlatformID) but cannot list them, so
 * the bot keeps its own registry of Discord users it has linked (table linked_discord, filled by
 * /linkaccount and by /checkaccount when it finds an existing link). A daily pass re-reads each
 * player's rank and swaps roles when it changed. Roles are only ever touched in
 * DISCORD_ROLES_GUILD_ID.
 *
 * Registry backends mirror lib/metrics.js: D1, node:sqlite, memory.
 */
import {
  assignDiscordRole,
  discordRoleForRank,
  removeDiscordRole,
} from "../platform/discord-rest.js";

export const REGISTRY_SQL =
  "CREATE TABLE IF NOT EXISTS linked_discord (discord_id TEXT PRIMARY KEY, chips_userid TEXT NOT NULL, username TEXT, rank TEXT, role_id TEXT, linked_at INTEGER NOT NULL, synced_at INTEGER)";
const UPSERT_SQL =
  "INSERT INTO linked_discord (discord_id, chips_userid, username, rank, role_id, linked_at, synced_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6) ON CONFLICT(discord_id) DO UPDATE SET chips_userid = ?2, username = ?3, rank = ?4, role_id = ?5, synced_at = ?6";
const LIST_SQL =
  "SELECT discord_id, chips_userid, username, rank, role_id FROM linked_discord ORDER BY synced_at ASC, rowid ASC LIMIT ?1";
const COUNT_SQL = "SELECT COUNT(*) AS n FROM linked_discord";

export function memoryRegistry() {
  const rows = new Map();
  let seq = 0;
  return {
    upsert: async (r) => {
      rows.set(r.discordId, { ...r, syncedAt: Date.now(), seq: ++seq });
    },
    list: async (limit = 200) =>
      [...rows.values()]
        .sort((a, b) => a.syncedAt - b.syncedAt || a.seq - b.seq)
        .slice(0, limit),
    count: async () => rows.size,
  };
}

const fromRow = (r) => ({
  discordId: r.discord_id,
  chipsUserid: r.chips_userid,
  username: r.username,
  rank: r.rank,
  roleId: r.role_id,
});

export function d1Registry(db) {
  if (!db) return memoryRegistry();
  return {
    upsert: async (r) => {
      try {
        await db
          .prepare(UPSERT_SQL)
          .bind(
            r.discordId,
            r.chipsUserid,
            r.username ?? null,
            r.rank ?? null,
            r.roleId ?? null,
            Date.now()
          )
          .run();
      } catch (err) {
        console.error("[rolesync] upsert failed:", err.message);
      }
    },
    list: async (limit = 200) => {
      try {
        const { results } = await db.prepare(LIST_SQL).bind(limit).all();
        return results.map(fromRow);
      } catch (err) {
        console.error("[rolesync] list failed:", err.message);
        return [];
      }
    },
    count: async () => {
      try {
        const r = await db.prepare(COUNT_SQL).first();
        return Number(r?.n || 0);
      } catch {
        return 0;
      }
    },
  };
}

export function sqliteRegistry(db) {
  if (!db) return memoryRegistry();
  db.exec(REGISTRY_SQL);
  const upsert = db.prepare(UPSERT_SQL);
  const list = db.prepare(LIST_SQL);
  const count = db.prepare(COUNT_SQL);
  return {
    upsert: async (r) => {
      upsert.run(
        r.discordId,
        r.chipsUserid,
        r.username ?? null,
        r.rank ?? null,
        r.roleId ?? null,
        Date.now()
      );
    },
    list: async (limit = 200) => list.all(limit).map(fromRow),
    count: async () => Number(count.get()?.n || 0),
  };
}

/**
 * Bring one member's role in line with their current rank. Removes the previous rank role if
 * it differs, adds the new one. Returns "unchanged" | "updated" | "skipped" | "failed".
 */
export async function syncOne(env, registry, entry, player) {
  const guild = env.DISCORD_ROLES_GUILD_ID;
  if (!guild) return "skipped";
  const rank = player?.vip?.rank || null;
  const roleId = discordRoleForRank(rank);
  if (roleId === entry.roleId && rank === entry.rank) {
    await registry.upsert({ ...entry, rank, roleId });
    return "unchanged";
  }
  let ok = true;
  if (entry.roleId && entry.roleId !== roleId)
    ok =
      (await removeDiscordRole(env, guild, entry.discordId, entry.roleId)) &&
      ok;
  if (roleId)
    ok = (await assignDiscordRole(env, guild, entry.discordId, roleId)) && ok;
  if (ok)
    await registry.upsert({
      ...entry,
      username: player?.username || entry.username,
      rank,
      roleId,
    });
  return ok ? "updated" : "failed";
}

/**
 * Daily pass. Bounded per run (Discord rate limits: ~50 req/s global, role edits ~10/10s per guild);
 * the registry lists least-recently-synced first so a big table rolls over several days.
 */
export async function runRoleSync({ env, api, registry, limit = 150 }) {
  if (!env.DISCORD_TOKEN || !env.DISCORD_ROLES_GUILD_ID)
    return { skipped: "unconfigured" };
  const entries = await registry.list(limit);
  const out = { checked: 0, updated: 0, unchanged: 0, failed: 0, missing: 0 };
  for (const e of entries) {
    out.checked += 1;
    let player = null;
    try {
      player = await api.public("getPlayer", { userid: e.chipsUserid });
    } catch (err) {
      out.missing += 1;
      console.warn(
        `[rolesync] getPlayer ${e.chipsUserid} failed:`,
        err.message
      );
      continue;
    }
    const r = await syncOne(env, registry, e, player);
    if (r === "updated") out.updated += 1;
    else if (r === "unchanged") out.unchanged += 1;
    else if (r === "failed") out.failed += 1;
    // spread role edits out; 150 members * 250ms = ~40s, well under a DO alarm budget
    await new Promise((res) => setTimeout(res, 250));
  }
  console.log(`[rolesync] ${JSON.stringify(out)}`);
  return out;
}
