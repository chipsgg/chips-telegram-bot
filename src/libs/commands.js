const assert = require("assert");
const _ = require("lodash");
const models = require("./models");
const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");

module.exports = (api) => {
  assert(api, "requires api");

  const commands = {
    linkaccount: {
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
            "Please provide both username and TOTP code. Usage: /linkaccount username:YOUR_USERNAME totp:YOUR_CODE"
          );
        }

        const payload = {
          platformid: ctx.userid.toString(),
          platform: ctx.platform,
          userid: username,
          code: totpCode,
        };

        try {
          const account = await api._actions.auth("linkPlatformID", payload);

          const [player, vip] = await Promise.all([
            api._actions.public("getUser", {
              userid: account.userid,
            }),
            api._actions.public("getUserVipRank", {
              userid: account.userid,
            }),
          ]);

          console.log("Linking:", player, vip);

          // Automatically assign the role in Discord after linking
          await assignDiscordRole(ctx, vip.rank);

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
    },
  };

  async function assignDiscordRole(ctx, rank) {
    try {
      if (ctx.platform !== "discord") return;

      const roleID = getRoleIdByRank(rank);
      if (!roleID) {
        console.warn(`No role ID found for rank: ${rank}`);
        return;
      }

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

      const member = await guild.members.fetch(ctx.userid);
      if (!member) {
        console.warn(`Member ${ctx.userid} not found in guild`);
        return;
      }

      const { PermissionFlagsBits } = require("discord.js");
      const botMember = await guild.members.fetch(
        ctx.interaction.client.user.id
      );
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
      rank.toLowerCase().includes(key)
    );
    return match ? roles[match] : null;
  }

  // Get user
  commands.user = {
    description: "Get user information by username",
    options: {
      username: {
        description: "Chips.gg username",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    },
    handler: async (ctx) => {
      let username = null;
      if (ctx.platform === "discord") {
        username = ctx?.getString("username");
      } else {
        username = ctx?.getArg(1);
      }

      if (!username) {
        return ctx.sendText("Please provide a username");
      }

      try {
        const user = await api._actions.public("getUser", { userid: username });
        if (!user) {
          return ctx.sendText("User not found");
        }

        const [vip, stats] = await Promise.all([
          api._actions.public("getUserVipRank", {
            userid: user.id,
          }),
          api._actions.public("getUserStats", {
            userid: user.id,
            duration: "1m",
          }),
        ]);

        console.log("/user", {
          user,
          vip,
          stats,
        });

        return ctx.sendForm({
          emoji: "👤",
          title: `User Info: ${user.username}`,
          content: [
            `Username: ${user.username}`,
            `Level: ${vip.rank} (${vip.level || "0"})`,
            `Total Bets: ${stats.count.toLocaleString() || 0}`,
            `Total Wins: ${stats.wins.toLocaleString() || 0}`,
            `Total Wagered: $${(stats.wageredUsd || 0).toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`,
            `Total Bonuses: $${(stats.bonusesUsd || 0).toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`,
            `Join Date: ${new Date(user.created).toLocaleDateString()}`,
          ].join("\n"),
          url: `https://chips.gg/user/${user.username}`,
          buttonLabel: "View Profile",
        });
      } catch {
        return ctx.sendText("Error fetching user information");
      }
    },
  };

  commands.chat = {
    description: "Get invite links to official Telegram/Discord communities",
    handler: (ctx) =>
      ctx.sendForm({
        emoji: "💬",
        title: "Official Communities",
        content: [
          "Join our communities to chat with other players!",
          "",
          "Discord: https://discord.gg/chips",
          "Telegram: https://t.me/chipsgg",
        ].join("\n"),
        buttonLabel: "Join Discord",
        url: "https://discord.gg/chips",
      }),
  };

  commands.mostplayed = {
    description: "List most played games",
    handler: async (ctx) => {
      const games = await api._actions.public("listGamesMostPlayed", {
        skip: 0,
        limit: 10,
        duration: "1m",
      });

      return ctx.sendForm({
        emoji: "🎮",
        title: "Most Played Games",
        content: games
          .map(
            (game, index) => `${index + 1}. ${game.title} (${game.provider})`
          )
          .join("\n"),
        url: "https://chips.gg/casino",
        buttonLabel: "Play Now",
      });
    },
  };

  commands.koth = {
    description: "Display current King of the Hill information",
    handler: async (ctx) => {
      // const koth = api.get('public', 'koth');

      return ctx.sendForm({
        emoji: "👑",
        title: "KING OF THE HILL",
        banner: `https://stats.chips.gg/koth`,
        buttonLabel: "BE KING.",
        url: "https://chips.gg/koth",
      });
    },
  };

  commands.search = {
    description: "Search the game catalog. Usage: /search game_name",
    options: {
      query: {
        description: "Search query",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    },
    handler: async (ctx) => {
      let query = null;
      if (ctx.platform === "discord" || ctx.platform === "api") {
        query = ctx?.getString("query");
      } else {
        query = ctx?.getArg(1);
      }

      if (!query) {
        return ctx.sendText(
          "Please provide a search query. Usage: /search game_name"
        );
      }

      try {
        const games = await api._actions.public("searchGames", {
          skip: 0,
          limit: 5,
          term: query,
        });

        if (!games || games.length === 0) {
          return ctx.sendForm({
            emoji: "🎮",
            title: "Game Search",
            content: "No games found matching your search.",
            url: "https://chips.gg/casino",
            buttonLabel: "Browse Games",
          });
        }

        const gameList = games
          .map(
            (game, index) =>
              `${index + 1}. ${game.title} (${game.provider})\n   ID: ${game.id}`
          )
          .join("\n");

        return ctx.sendForm({
          emoji: "🎮",
          title: "Game Search Results",
          content: `Found ${games.length} games matching "${query}":\n\n${gameList}`,
          url: "https://chips.gg/casino",
          buttonLabel: "Play Now",
        });
      } catch (error) {
        return ctx.sendText("Error searching games: " + error.message);
      }
    },
  };

  commands.help = {
    description: "Description of all commands",
    handler: (ctx) => ctx.sendForm(models.help(commands)),
  };

  const loadedCommands = loadCommands(api);
  Object.assign(commands, loadedCommands);

  console.log(`Loaded ${Object.keys(commands).length} commands!`);

  return commands;
};

function loadCommands(api) {
  const fs = require("fs");
  const path = require("path");

  const commands = {};
  const dir = path.join(__dirname, "../commands");
  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (!file.endsWith(".js")) continue;

    try {
      const module = require(path.join(dir, file));
      const command = module(api);
      commands[command.name || file.replace(".js", "").trim()] = command;
    } catch (error) {
      console.error("Error loading command:", file, error);
    }
  }

  return commands;
}
