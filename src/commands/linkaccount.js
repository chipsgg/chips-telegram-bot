/**
 * Link Account Command
 * Links a Discord or Telegram account to a Chips.gg account using
 * a username and TOTP (time-based one-time password) verification code.
 * On Discord, the reply is ephemeral to protect sensitive credentials.
 * After successful linking, assigns the appropriate VIP role on Discord.
 */
const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");

module.exports = (api) => ({
  name: "linkaccount",
  description: "Link your account to the site.",
  options: {
    username: {
      description: "Your Chips.gg username",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    totp: {
      description: "Your TOTP code",
      type: ApplicationCommandOptionType.Number,
      required: true,
    },
  },
  defer: false,
  handler: async (ctx) => {
    let username, totpCode;
    if (ctx.platform === "discord") {
      // Defer reply as ephemeral to hide sensitive TOTP info
      await ctx.interaction.deferReply({
        flags: [MessageFlags.Ephemeral],
      });

      username = ctx.getString("username");
      totpCode = ctx.getNumber("totp");
    } else {
      username = ctx.getArg(1);
      totpCode = ctx.getArg(2);
    }

    console.info("linkaccount", { username, totpCode });

    if (!username || !totpCode) {
      return ctx.sendText(
        "Please provide both username and TOTP code. Usage: /linkaccount username:YOUR_USERNAME totp:YOUR_CODE",
      );
    }

    // Build the linking payload with platform identity and TOTP code
    const payload = {
      platformid: ctx.userid.toString(),
      platform: ctx.platform,
      userid: username,
      code: totpCode,
    };

    try {
      // Link the platform account via auth API and fetch player data
      const account = await api._actions.auth("linkPlatformID", payload);
      const player = await api._actions.public("getPlayer", {
        userid: account.userid,
      });

      // Assign the corresponding Discord VIP role based on player rank
      await assignDiscordRole(ctx, player.vip.rank);

      const response = {
        emoji: "🔐",
        title: "Authentication Success",
        content: `Your ${payload.platform} has been linked!`,
        buttonLabel: "Visit Profile",
        url: `https://chips.gg/user/${username}`,
        ephemeral: true,
      };
      return ctx.sendForm(response);
    } catch (error) {
      console.error("/linkaccount", error);
      return ctx.sendText("Failed to link account: " + error.message);
    }
  },
});

/**
 * Assigns a Discord VIP role to the user based on their Chips.gg rank.
 * Verifies guild context and bot permissions before assigning.
 */
async function assignDiscordRole(ctx, rank) {
  try {
    // Only applies to Discord platform
    if (ctx.platform !== "discord") return;

    // Map the player rank to a Discord role ID
    const roleID = getRoleIdByRank(rank);
    if (!roleID) {
      console.warn(`No role ID found for rank: ${rank}`);
      return;
    }

    // Fetch the guild (server) context
    const guild = await ctx.guild?.fetch();
    if (!guild) {
      console.warn("No guild context available");
      return;
    } else {
      // const ALLOWED_GUILD_ID = "541035273547415552";
      // if (guild.id !== ALLOWED_GUILD_ID) {
      //   console.warn(
      //     `Role assignment not allowed in guild: ${ctx.guild?.id}`,
      //   );
      //   return;
      // }
    }

    // Fetch the member from the guild
    const member = await guild.members.fetch(ctx.userid);
    if (!member) {
      console.warn(`Member ${ctx.userid} not found in guild`);
      return;
    }

    // Verify the bot has permission to manage roles
    const { PermissionFlagsBits } = require("discord.js");
    const botMember = await guild.members.fetch(ctx.interaction.client.user.id);
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      console.warn("Bot missing MANAGE_ROLES permission");
      return;
    }
    // if (member.roles.highest.position >= botMember.roles.highest.position) {
    //   console.warn("Bot role position too low to modify member");
    //   return;
    // }
    await member.roles.add(roleID);
    console.log(`Assigned role ${rank} to user ${ctx.userid}`);
  } catch (error) {
    console.error("Error assigning role:", error);
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
    // tycoon: "1106520974289010769",
    degen: "1084469527737278484",
    booster: "581236016443031677",
    affiliate: "770390850739109900",
  };

  const match = Object.keys(roles).find((key) =>
    rank.toLowerCase().includes(key),
  );
  return match ? roles[match] : null;
}
