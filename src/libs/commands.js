const assert = require("assert");
const _ = require("lodash");
const models = require("./models");

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
      handler: (ctx) => {
        const currency = ctx.options?.getString("currency")?.toLowerCase();
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
  };

  // help menu
  commands.user = {
    description: "Get user information by username",
    handler: async (ctx) => {
      const username = ctx.options?.getString("username");
      if (!username) {
        return ctx.sendText("Please provide a username");
      }

      try {
        const user = await api._actions.public("getUser", { userid: username });
        if (!user) {
          return ctx.sendText("User not found");
        }

        const vip = await api._actions.public("getUserVipRank", {
          userid: user.id,
        });
        const stats = await api._actions.public("getUserStats", {
          userid: user.id,
          duration: "1m",
        });

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

  commands.auth = {
    description: "Authenticate and link your account",
    handler: async (ctx) => {
      const username = ctx.options?.getString("username");
      const totpCode = ctx.options?.getString("totp");

      if (!username || !totpCode) {
        return ctx.sendText(
          "Please provide both username and TOTP code. Usage: /auth username:YOUR_USERNAME totp:YOUR_CODE",
        );
      }

      // Get platform-specific ID
      let platformid = null;
      let platform = null;

      if (ctx.update?.message?.from?.id) {
        // Telegram
        platformid = ctx.update.message.from.id;
        platform = "telegram";
      } else if (ctx.interaction?.user?.id) {
        // Discord
        platformid = ctx.interaction.user.id;
        platform = "discord";
      }

      try {
        // Store the ID mapping
        const account = await api._actions.auth("linkPlatformID", {
          platformid,
          platform,
          userid: username,
          code: totpCode,
        });

        return ctx.sendForm({
          emoji: "🔐",
          title: "Authentication Success",
          content: `Your ${platform} ID (${platformid}) has been linked to account: ${username}`,
          buttonLabel: "Visit Profile",
          url: `https://chips.gg/user/${username}`,
        });
      } catch (error) {
        return ctx.sendText("Failed to authenticate: " + error.message);
      }
    },
  };

  commands.help = {
    description: "Description of all commands",
    handler: (ctx) => ctx.sendForm(models.help(commands)),
  };

  return commands;
};
