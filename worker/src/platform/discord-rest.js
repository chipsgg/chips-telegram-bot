/**
 * Discord REST helpers: embed/form builder, ephemeral flag, role assignment.
 * Plain fetch against discord.com/api/v10 — no discord.js.
 */
const DISCORD_API = "https://discord.com/api/v10";
const FAVICON =
  "https://cdn.chips.gg/public/images/assets/favicon/favicon-32x32.png";

// Bot form -> Discord message payload (embed + optional link/reroll buttons)
export function discordMakeForm(form) {
  const {
    emoji = "",
    title = "",
    content,
    footer,
    banner,
    url,
    buttonLabel,
    reroll,
    ephemeral,
  } = form;
  const embed = {
    title: `${emoji.trim()} ${title.trim()} ${emoji.trim()}`.trim(),
  };
  const desc = (content || "").trim();
  if (desc) embed.description = desc.slice(0, 4096);
  if (footer) embed.footer = { text: footer.trim(), icon_url: FAVICON };
  if (banner) embed.image = { url: banner };
  if (url) embed.url = url;

  const buttons = [];
  if (url && buttonLabel)
    buttons.push({ type: 2, style: 5, label: buttonLabel.slice(0, 80), url });
  if (reroll)
    buttons.push({
      type: 2,
      style: 1,
      label: "Reroll",
      custom_id: `reroll:${reroll}`,
    });

  const payload = {
    content: "",
    embeds: [embed],
    components: buttons.length ? [{ type: 1, components: buttons }] : [],
  };
  return ephemeral ? applyEphemeral(payload) : payload;
}

export const applyEphemeral = (payload) => ({
  ...payload,
  flags: (payload.flags || 0) | 64,
});

// VIP rank -> Discord role id (Chips.gg guild)
const ROLE_BY_RANK = {
  flipper: "1106398232382291978",
  collector: "1106398500020834405",
  stacker: "1106520974289010769",
  degen: "1084469527737278484",
  booster: "581236016443031677",
  affiliate: "770390850739109900",
};

export function discordRoleForRank(rank) {
  const r = String(rank || "").toLowerCase();
  const key = Object.keys(ROLE_BY_RANK).find((k) => r.includes(k));
  return key ? ROLE_BY_RANK[key] : null;
}

// PUT /guilds/{guild}/members/{user}/roles/{role}; needs MANAGE_ROLES on the bot. Returns bool.
export async function assignDiscordRole(env, guildId, userId, roleId) {
  if (!env.DISCORD_TOKEN) return false;
  try {
    const res = await fetch(
      `${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      {
        method: "PUT",
        headers: {
          authorization: `Bot ${env.DISCORD_TOKEN}`,
          "x-audit-log-reason": "chips.gg account linked",
        },
      }
    );
    if (!res.ok) console.warn("[discord] role assign failed:", res.status);
    return res.ok;
  } catch (err) {
    console.warn("[discord] role assign error:", err.message);
    return false;
  }
}

// POST a form to a channel (proactive announcements). Needs Send Messages + Embed Links.
export async function postDiscordChannel(env, channelId, form) {
  if (!env.DISCORD_TOKEN) return false;
  try {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bot ${env.DISCORD_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(discordMakeForm(form)),
    });
    if (!res.ok)
      console.warn(
        `[discord] channel post ${channelId} failed:`,
        res.status,
        (await res.text()).slice(0, 200)
      );
    return res.ok;
  } catch (err) {
    console.warn("[discord] channel post error:", err.message);
    return false;
  }
}

// Bulk-overwrite global application commands (used by scripts/register-discord.js)
export async function registerCommands(env, payload) {
  const res = await fetch(
    `${DISCORD_API}/applications/${env.DISCORD_APPLICATION_ID}/commands`,
    {
      method: "PUT",
      headers: {
        authorization: `Bot ${env.DISCORD_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  return { ok: res.ok, status: res.status, body: await res.text() };
}
