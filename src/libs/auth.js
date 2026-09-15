/**
 * Caller identity helpers
 * Resolve the Chips.gg account linked to the invoking Discord/Telegram user and
 * decide whether they hold staff privileges.
 */

// Linked Chips.gg account for this caller, or null when unlinked.
// Shape (auth/getUserByPlatformID): { id, username, avatar, nickname, isAdmin, isMod, isPrivate, referrer }
exports.linkedAccount = async (api, ctx) => {
  if (!ctx.platform || ctx.userid === undefined || ctx.userid === null)
    return null;
  if (ctx.platform === "api") return null;
  try {
    const user = await api._actions.auth("getUserByPlatformID", {
      platform: ctx.platform,
      platformid: String(ctx.userid),
    });
    return user?.id ? user : null;
  } catch (err) {
    const msg = String(err?.message || "");
    if (/not found|no user|does not exist/i.test(msg)) return null;
    throw err;
  }
};

// Staff = linked account flagged admin/mod, or carrying the `backoffice` role.
// The platform-ID lookup has no `roles`, so fall back to the backoffice profile.
exports.isStaff = async (api, account) => {
  if (!account) return false;
  if (account.isAdmin || account.isMod) return true;
  try {
    const profile = await api._actions.backoffice("getUser", {
      userid: account.id,
    });
    return (
      Array.isArray(profile?.roles) && profile.roles.includes("backoffice")
    );
  } catch (err) {
    console.warn("[auth] backoffice/getUser failed:", err.message);
    return false;
  }
};
