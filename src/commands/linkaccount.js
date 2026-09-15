/**
 * Link Account Command
 * Links a Discord or Telegram account to a Chips.gg account using
 * a username and TOTP (time-based one-time password) verification code.
 *
 * Secrecy rules:
 *  - Discord: reply is ephemeral (only the caller sees it).
 *  - Telegram: only accepted in a private chat with the bot; in groups we refuse
 *    and try to delete the message so the code never sits in group history.
 *  - The TOTP code is never logged.
 *
 * After successful linking, assigns the appropriate VIP role on Discord.
 */
const {
  ApplicationCommandOptionType,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");
const { arg } = require("../libs/utils");

const USAGE_DISCORD =
  "/linkaccount username:<your username> totp:<6-digit code>";
const USAGE_TELEGRAM = "/linkaccount <your username> <6-digit code>";

module.exports = (api) => ({
  name: "linkaccount",
  description: "Link your Chips.gg account (requires 2FA code).",
  options: {
    username: {
      description: "Your Chips.gg username",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    totp: {
      description: "Your 6-digit 2FA code",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  },
  defer: false,
  handler: async (ctx) => {
    if (ctx.platform === "api") {
      return ctx.sendText(
        "Account linking is only available inside Discord or Telegram."
      );
    }

    if (ctx.platform === "discord") {
      // Defer reply as ephemeral to hide sensitive TOTP info
      await ctx.interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    }

    if (ctx.platform === "telegram" && !ctx.isPrivate) {
      // Never let a 2FA code live in a group chat. Best-effort delete needs admin rights.
      await ctx.deleteMessage?.().catch(() => undefined);
      return ctx.sendText(
        "For your security, link your account in a private chat with me: open my profile and press Start, then send " +
          `\`${USAGE_TELEGRAM}\`.`
      );
    }

    const username = arg(ctx, "username", 1);
    const totpCode = arg(ctx, "totp", 2);

    if (!username || !/^\d{6}$/.test(totpCode || "")) {
      return ctx.sendText(
        `Please provide your username and a 6-digit 2FA code.\nUsage: ${
          ctx.platform === "discord" ? USAGE_DISCORD : USAGE_TELEGRAM
        }`
      );
    }

    console.info("[linkaccount] attempt", {
      platform: ctx.platform,
      platformid: String(ctx.userid),
      username,
    });

    // Build the linking payload with platform identity and TOTP code
    const payload = {
      platformid: String(ctx.userid),
      platform: ctx.platform,
      userid: username,
      code: Number(totpCode),
    };

    try {
      // Link the platform account via auth API and fetch player data
      const account = await api._actions.auth("linkPlatformID", payload);
      const player = await api._actions.public("getPlayer", {
        userid: account.userid,
      });

      // Assign the corresponding Discord VIP role based on player rank
      const roleResult = await assignDiscordRole(ctx, player?.vip?.rank);

      const lines = [
        `Your ${ctx.platform} account is now linked to **${player.username}**.`,
      ];
      if (player?.vip?.rank) lines.push(`VIP rank: ${player.vip.rank}`);
      if (roleResult === "assigned") lines.push("Discord role updated.");

      return ctx.sendForm({
        emoji: "🔐",
        title: "Account Linked",
        content: lines.join("\n"),
        buttonLabel: "Visit Profile",
        url: `https://chips.gg/user/${player.username}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("[linkaccount] failed:", error.message);
      return ctx.sendText(
        `Failed to link account: ${error.message}\nCheck the username and that the 2FA code is current.`
      );
    }
  },
});

/**
 * Assigns a Discord VIP role to the user based on their Chips.gg rank.
 * Returns "assigned" | "skipped".
 */
async function assignDiscordRole(ctx, rank) {
  try {
    if (ctx.platform !== "discord" || !rank) return "skipped";

    const roleID = getRoleIdByRank(rank);
    if (!roleID) {
      console.warn(`[linkaccount] no role mapped for rank: ${rank}`);
      return "skipped";
    }

    const guild = await ctx.guild?.fetch();
    if (!guild) return "skipped";

    const member = await guild.members.fetch(ctx.userid);
    if (!member) return "skipped";

    const botMember = await guild.members.fetch(ctx.interaction.client.user.id);
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      console.warn("[linkaccount] bot missing MANAGE_ROLES permission");
      return "skipped";
    }
    await member.roles.add(roleID);
    console.log(`[linkaccount] assigned role ${rank} to ${ctx.userid}`);
    return "assigned";
  } catch (error) {
    console.error("[linkaccount] role assignment error:", error.message);
    return "skipped";
  }
}

/**
 * Maps a Chips.gg VIP rank name to its corresponding Discord role ID.
 * Returns null if no matching role is found.
 */
function getRoleIdByRank(rank) {
  const roles = {
    flipper: "1106398232382291978",
    collector: "1106398500020834405",
    stacker: "1106520974289010769",
    degen: "1084469527737278484",
    booster: "581236016443031677",
    affiliate: "770390850739109900",
  };

  const match = Object.keys(roles).find((key) =>
    String(rank).toLowerCase().includes(key)
  );
  return match ? roles[match] : null;
}
