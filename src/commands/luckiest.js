const _ = require("lodash");
const models = require("../libs/models");
const { formatCurrency } = require("@coingecko/cryptoformat");
const Humanize = require("humanize-plus");

module.exports = (api) => ({
  name: "luckiest",
  description: "Ranking of the luckiest players",
  handler: (ctx) => {
    const currencies = {}; // Cache currency data

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
        const currency = currencies[obj.bet.currency]
          ? currencies[obj.bet.currency]
          : api.get("public", "currencies", obj.bet.currency);
        currencies[obj.bet.currency] ??= currency;

        obj.bet.amountInDollar =
          (obj.bet.amount / Math.pow(10, currency.decimals)) * currency.price;
        obj.bet.winningsInDollar =
          (obj.bet.winnings / Math.pow(10, currency.decimals)) * currency.price;
        return obj;
      })
      .value();

    if (ctx.platform !== "discord") {
      return ctx.sendForm(models.luckiest(top));
    }

    const content = top
      .map((win, i) => {
        const { player, bet, game } = win;
        const { username } = player;
        const { amountInDollar, winningsInDollar, multiplier } = bet;
        const { title, slug } = game;

        return (
          `${i + 1}. ${formatCurrency(amountInDollar, "USD", "en")} ➜ **${formatCurrency(winningsInDollar, "USD", "en")}** (${Humanize.formatNumber(multiplier, 2)}x)\n` +
          `-# Won by [${username}](https://chips.gg/user/${username}) in [${title}](https://chips.gg/play/${slug})`
        );
      })
      .join("\n");

    ctx.sendForm({
      emoji: "🎰",
      title: "Luckiest Wins",
      content,
    });
  },
});
