/**
 * Luckiest Wins Command
 * Displays a ranking of the luckiest players sorted by bet multiplier.
 * Converts crypto bet amounts to USD using live currency data.
 * Shows top 10 unique players with bet amount, winnings, multiplier, and game info.
 */
const _ = require("lodash");
const models = require("../libs/models");
const { formatCurrency } = require("@coingecko/cryptoformat");
const Humanize = require("humanize-plus");

module.exports = (api) => ({
  name: "luckiest",
  description: "Ranking of the luckiest players",
  handler: (ctx) => {
    const currencies = {}; // Cache currency data to avoid redundant lookups

    // Retrieve luckiest wins data from the stats store
    const luckiest = api.get("stats", "bets", "luckiest");
    const top = _.chain(luckiest)
      .keys()
      .map((id) => luckiest[id])
      .filter((obj) => _.keys(obj.bet).length > 0)
      // Sort by multiplier (highest first)
      .orderBy((obj) => obj.bet.multiplier)
      .reverse()
      .uniqBy("userid") // One entry per player
      .take(10)
      // Convert bet amounts and winnings to USD for display
      .map((obj) => {
        const currency = currencies[obj.bet.currency]
          ? currencies[obj.bet.currency]
          : api.get("public", "currencies", obj.bet.currency);
        currencies[obj.bet.currency] ??= currency;

        // Convert from smallest unit to USD: (amount / 10^decimals) * price
        obj.bet.amountInDollar =
          (obj.bet.amount / Math.pow(10, currency.decimals)) * currency.price;
        obj.bet.winningsInDollar =
          (obj.bet.winnings / Math.pow(10, currency.decimals)) * currency.price;
        return obj;
      })
      .value();

    // Non-Discord platforms use the model formatter
    if (ctx.platform !== "discord") {
      return ctx.sendForm(models.luckiest(top));
    }

    // Discord: format each win entry with hyperlinks
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
