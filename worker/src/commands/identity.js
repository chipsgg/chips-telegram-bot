/**
 * Caller identity: the Chips.gg account linked to a Discord/Telegram user, and staff check.
 */
export const linkedAccount = async (api, ctx) => {
  if (
    !ctx.platform ||
    ctx.userid === undefined ||
    ctx.userid === null ||
    ctx.platform === "api"
  )
    return null;
  try {
    const user = await api.auth("getUserByPlatformID", {
      platform: ctx.platform,
      platformid: String(ctx.userid),
    });
    return user?.id ? user : null;
  } catch (err) {
    if (/not found|no user|does not exist/i.test(String(err?.message || "")))
      return null;
    throw err;
  }
};

// Staff = admin/mod flag on the linked account, or `backoffice` role on the backoffice profile
// (auth/getUserByPlatformID carries no `roles`; backoffice/getUser does).
export const isStaff = async (api, account) => {
  if (!account) return false;
  if (account.isAdmin || account.isMod) return true;
  if (!api.hasToken) return false;
  try {
    const profile = await api.backoffice("getUser", { userid: account.id });
    return (
      Array.isArray(profile?.roles) && profile.roles.includes("backoffice")
    );
  } catch (err) {
    console.warn("[identity] backoffice/getUser failed:", err.message);
    return false;
  }
};
