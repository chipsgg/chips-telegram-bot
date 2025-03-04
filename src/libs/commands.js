const assert = require("assert");
const _ = require("lodash");
const models = require("./models");
const { ApplicationCommandOptionType } = require("discord.js");

module.exports = (api) => {
  assert(api, "requires api");

  const commands = {
    slotcall: {
      description: "Get a random slot",
      handler: async (ctx) => {
        const slot = await api.getRandomSlot();

        return ctx.sendForm(
          models.slotcall({
            ...slot,
          }),
        );
      },
    },
    prices: {
      description:
        "The different cryptocurrencies and their values in dollars. Usage: /prices [currency]",
      options: {
        currency: {
          description: "Currency to filter by",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      },
      handler: (ctx) => {
        let currency = null;
        if (ctx.platform === "discord") {
          currency = ctx?.getString("currency")?.toLowerCase();
        } else {
          currency = ctx?.getArg(1);
        }

        let currencies = _.chain(api.get("public", "currencies")).filter(
          (x) =>
            !x.hidden &&
            x.name !== "chips" &&
            x.name !== "chips_staking" &&
            !_.startsWith(x.name, "usd") &&
            !_.endsWith(x.name, "usd"),
        );

        if (currency) {
          currencies = currencies.filter(
            (x) => x.name.toLowerCase() === currency,
          );
          if (currencies.value().length === 0) {
            return ctx.sendText(
              "Currency not found. Use /prices to see all available currencies.",
            );
          }
        }

        return ctx.sendForm(models.prices(currencies.value()));
      },
    },
    promotions: {
      description: "Ongoing promotions and events",
      handler: async (ctx) => {
        const activeRaces = await api._actions.public("listRunningPromotions");
        return ctx.sendForm(models.events(activeRaces));
      },
    },
    vault: {
      description: "The vault and rewards related",
      handler: (ctx) => {
        const distributeAt = api.get(
          "profitshare",
          "profitshareInfo",
          "distributeAt",
        );
        const totalMinted =
          api.get("profitshare", "profitshareInfo", "totalMinted") / 1000000;
        const totalStaked =
          api.get("profitshare", "profitshareInfo", "totalStaked") / 1000000;
        const currencies = _.chain(api.get("public", "currencies"))
          .filter(
            ({ name, hidden }) =>
              !hidden && !_.includes(name, ["chips", "chips_staking"]),
          )
          .map(({ name, price, decimals }) => ({
            name: _.upperCase(name),
            value:
              api.get("profitshare", "profitshareBalance", name) /
                Math.pow(10, decimals) || 0,
            price: price || 1,
          }))
          .value();
        const totalValue = _.chain(currencies)
          .filter(({ value }) => value > 0.0)
          .sumBy(({ value, price }) => value * price)
          .value();
        const perThousand = (totalValue / 4 / totalStaked) * 1000;

        return ctx.sendForm(
          models.vault({
            currencies,
            distributeAt,
            totalMinted,
            totalStaked,
            totalValue,
            perThousand,
          }),
        );
      },
    },
    bigwins: {
      description: "Ranking of players with big wins",
      handler: (ctx) => {
        const bigwins = api.get("stats", "bets", "bigwins");
        const top = _.chain(bigwins)
          .keys()
          .map((id) => bigwins[id])
          .filter(({ bet }) => _.keys(bet).length > 0)
          .orderBy(({ bet }) => {
            const currency = api.get("public", "currencies", bet.currency);
            if (!currency) return 0; // Skip invalid currencies
            return bet.winnings / Math.pow(10, currency.decimals);
          })
          .reverse()
          .uniqBy("userid")
          .take(10)
          .map((obj) => {
            const currency = api.get("public", "currencies", obj.bet.currency);
            if (!currency) return obj; // Skip currency conversion if data missing
            const { price, decimals } = currency;
            obj.bet.amountInDollar =
              (obj.bet.amount / Math.pow(10, decimals)) * price;
            obj.bet.winningsInDollar =
              (obj.bet.winnings / Math.pow(10, decimals)) * price;
            return obj;
          })
          .value();

        return ctx.sendForm(models.bigwins(top));
      },
    },
    luckiest: {
      description: "Ranking of the luckiest players",
      handler: (ctx) => {
        const luckiest = api.get("stats", "bets", "luckiest");
        const top = _.chain(luckiest)
          .keys()
          .map((id) => luckiest[id])
          .filter((obj) => _.keys(obj.bet).length > 0)
          .orderBy((obj) => obj.bet.multiplier)
          .reverse()
          .uniqBy("userid")
          .take(10)
          .map((obj) => {
            const currency = api.get("public", "currencies", obj.bet.currency);
            obj.bet.amountInDollar =
              (obj.bet.amount / Math.pow(10, currency.decimals)) *
              currency.price;
            obj.bet.winningsInDollar =
              (obj.bet.winnings / Math.pow(10, currency.decimals)) *
              currency.price;
            return obj;
          })
          .value();

        return ctx.sendForm(models.luckiest(top));
      },
    },
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
      handler: async (ctx) => {
        let username, totpCode;
        if (ctx.platform === "discord") {
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

          return ctx.sendForm({
            emoji: "🔐",
            title: "Authentication Success",
            content: `Your ${payload.platform} has been linked!`,
            buttonLabel: "Visit Profile",
            url: `https://chips.gg/user/${username}`,
          });
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

      const botMember = await guild.members.fetch(ctx.userid);
      if (!botMember.permissions.has("MANAGE_ROLES")) {
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
      rank.toLowerCase().includes(key),
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
              },
            )}`,
            `Total Bonuses: $${(stats.bonusesUsd || 0).toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}`,
            `Join Date: ${new Date(user.created).toLocaleDateString()}`,
          ].join("\n"),
          url: `https://chips.gg/user/${user.username}`,
          buttonLabel: "View Profile",
        });
      } catch (error) {
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
            (game, index) => `${index + 1}. ${game.title} (${game.provider})`,
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
      const koth = api.get("public", "koth");

      if (ctx.platform === "telegram") {
        return ctx.sendForm({
          emoji: "👑",
          title: "KING OF THE HILL",
          banner: `https://stats.chips.gg/koth`,
          buttonLabel: "BE KING.",
          url: "https://chips.gg/koth",
        });
      } else {
        return ctx.sendForm({
          emoji: "👑",
          title: "KING OF THE HILL",
          content: "Current KOTH Challenge:",
          image: {
            url: `https://stats.chips.gg/koth`,
          },
          button: {
            label: "BE KING.",
            url: "https://chips.gg/koth",
          },
        });
      }
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
          "Please provide a search query. Usage: /search game_name",
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
              `${index + 1}. ${game.title} (${game.provider})\n   ID: ${game.id}`,
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

  commands.stats = {
    description: "Show user stats banner. Usage: /stats username",
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
        if (!username) {
          return ctx.sendText("Please provide a username");
        }
      } else {
        username = ctx?.getArg(1);
        if (!username) {
          return ctx.sendText("Please provide a username");
        }
      }

      if (ctx.platform === "telegram") {
        return ctx.sendForm({
          emoji: "📊",
          title: `Stats Banner: ${username}`,
          // content: "Here are your stats:",
          banner: `https://stats.chips.gg/stats/${username}`,
          buttonLabel: "View Profile",
          url: `https://chips.gg/user/${username}`,
        });
      } else {
        return ctx.sendForm({
          emoji: "📊",
          title: `Stats Banner: ${username}`,
          content: "Here are your stats:",
          image: {
            url: `https://stats.chips.gg/stats/${username}`,
          },
          button: {
            label: "View Profile",
            url: `https://chips.gg/user/${username}`,
          },
        });
      }
    },
  };

  commands.promotion = {
    description: "Show promotion banner. Usage: /promotion promotionid",
    options: {
      promotionid: {
        description: "Promotion ID",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    },
    handler: async (ctx) => {
      let promotionId = null;
      if (ctx.platform === "discord") {
        promotionId = ctx?.getString("promotionid");
        if (!promotionId) {
          return ctx.sendText("Please provide a promotion ID");
        }
      } else {
        promotionId = ctx?.getArg(1);
        if (!promotionId) {
          return ctx.sendText("Please provide a promotion ID");
        }
      }

      try {
        const promotion = await api._actions.public("getPromotion", {
          // game: "promotion",
          gameid: promotionId, // roomid replaced with gameid when old game
        });

        if (ctx.platform === "telegram") {
          return ctx.sendForm({
            emoji: "🎉",
            title: promotion.title,
            banner: `https://stats.chips.gg/promotions/${promotionId}`,
            buttonLabel: "View Promotion",
            url: `https://chips.gg/promotions/${promotionId}`,
          });
        } else {
          return ctx.sendForm({
            emoji: "🎉",
            title: promotion.title,
            content: "Here is your promotion banner:",
            image: {
              url: `https://stats.chips.gg/promotions/promotion:${promotionId}`,
            },
            button: {
              label: "View Promotion",
              url: `https://chips.gg/promotions/${promotionId}`,
            },
          });
        }
      } catch (e) {
        return ctx.sendText("Error searching promotions: " + e.message);
      }
    },
  };

  commands.compare = {
    description:
      "Compare two users' stats. Usage: /compare username1 username2",
    options: {
      username1: {
        description: "First Chips.gg username",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      username2: {
        description: "Second Chips.gg username",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    },
    handler: async (ctx) => {
      let username1, username2;
      if (ctx.platform === "discord") {
        username1 = ctx?.getString("username1");
        username2 = ctx?.getString("username2");
        if (!username1 || !username2) {
          return ctx.sendText("Please provide both usernames to compare");
        }
      } else {
        username1 = ctx?.getArg(1);
        username2 = ctx?.getArg(2);
        if (!username1 || !username2) {
          return ctx.sendText("Please provide both usernames to compare");
        }
      }

      if (ctx.platform === "telegram") {
        return ctx.sendForm({
          emoji: "🔄",
          title: `Comparing ${username1} vs ${username2}`,
          banner: `https://stats.chips.gg/compare/${username1}/${username2}`,
          buttonLabel: "View Profiles",
          url: `https://chips.gg/user/${username1}`,
        });
      } else {
        return ctx.sendForm({
          emoji: "🔄",
          title: `Comparing ${username1} vs ${username2}`,
          content: "Here is your comparison:",
          image: {
            url: `https://stats.chips.gg/compare/${username1}/${username2}`,
          },
          button: {
            label: "View Profiles",
            url: `https://chips.gg/user/${username1}`,
          },
        });
      }
    },
  };

  commands.bet = {
    description: "Show bet card. Usage: /bet betid",
    options: {
      betid: {
        description: "Bet ID",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    },
    handler: async (ctx) => {
      let betId = null;
      if (ctx.platform === "discord") {
        betId = ctx?.getString("betid");
        if (!betId) {
          return ctx.sendText("Please provide a bet ID");
        }
      } else {
        betId = ctx?.getArg(1);
        if (!betId) {
          return ctx.sendText("Please provide a bet ID");
        }
      }

      if (ctx.platform === "telegram") {
        return ctx.sendForm({
          emoji: "🎲",
          title: `Bet: ${betId}`,
          banner: `https://stats.chips.gg/bets/${betId}`,
          // buttonLabel: "View Bet",
          // url: `https://chips.gg/bets/${betId}`,
        });
      } else {
        return ctx.sendForm({
          emoji: "🎲",
          title: `Bet: ${betId}`,
          content: "Here is your bet card:",
          image: {
            url: `https://stats.chips.gg/bets/${betId}`,
          },
          // button: {
          //   label: "View Bet",
          //   url: `https://chips.gg/bets/${betId}`,
          // },
        });
      }
    },
  };

  commands.help = {
    description: "Description of all commands",
    handler: (ctx) => ctx.sendForm(models.help(commands)),
  };

  return commands;
};
