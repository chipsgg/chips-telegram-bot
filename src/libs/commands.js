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
          })
        );
      },
    },
    prices: {
      description: "The different cryptocurrencies and their values in dollars",
      handler: (ctx) => {
        const content = _.chain(api.get("public", "currencies"))
          .filter(
            (x) =>
              !x.hidden &&
              x.name !== "chips" &&
              x.name !== "chips_staking" &&
              !_.startsWith(x.name, "usd") &&
              !_.endsWith(x.name, "usd")
          )
          .value();

        return ctx.sendForm(models.prices(content));
      },
    },
    // events: {
    //   description: "Ongoing events",
    //   handler: async (ctx) => {
    //     const activeRaces = await api.listActiveRaces(0, 10);
    //     return ctx.sendForm(models.events(activeRaces));
    //   },
    // },
    vault: {
      description: "The vault and rewards related",
      handler: (ctx) => {
        const distributeAt = api.get(
          "profitshare",
          "profitshareInfo",
          "distributeAt"
        );
        const totalMinted =
          api.get("profitshare", "profitshareInfo", "totalMinted") / 1000000;
        const totalStaked =
          api.get("profitshare", "profitshareInfo", "totalStaked") / 1000000;
        const currencies = _.chain(api.get("public", "currencies"))
          .filter(
            ({ name, hidden }) =>
              !hidden && !_.includes(name, ["chips", "chips_staking"])
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
          })
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
      const username = ctx.options?.getString('username');
      if (!username) {
        return ctx.sendText("Please provide a username");
      }
      
      try {
        const user = await api._actions.public('getUser', { username });
        if (!user) {
          return ctx.sendText("User not found");
        }
        
        return ctx.sendForm({
          emoji: "👤",
          title: `User Info: ${user.username}`,
          content: [
            `Username: ${user.username}`,
            `Level: ${user.level || 'N/A'}`,
            `Total Bets: ${user.totalBets || 0}`,
            `Total Wagered: $${(user.totalWagered || 0).toFixed(2)}`,
            `Total Won: $${(user.totalWon || 0).toFixed(2)}`,
            `Join Date: ${new Date(user.createdAt).toLocaleDateString()}`
          ].join('\n'),
          url: `https://chips.gg/user/${user.username}`,
          buttonLabel: "View Profile"
        });
      } catch (error) {
        return ctx.sendText("Error fetching user information");
      }
    },
  };

  commands.help = {
    description: "Description of all commands",
    handler: (ctx) => ctx.sendForm(models.help(commands)),
  };

  return commands;
};
