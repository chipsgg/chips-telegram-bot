/**
 * Big Wins Command
 * Displays a ranking of players with the biggest wins, sorted by USD value.
 * Converts crypto bet amounts to USD using live currency data.
 * Shows top 10 unique players with bet amount, winnings, multiplier, and game info.
 */
const _ = require("lodash");
const models = require("../libs/models");
const { formatCurrency } = require("@coingecko/cryptoformat");
const Humanize = require("humanize-plus");

module.exports = (api) => ({
  name: "bigwins",
  description: "Ranking of players with big wins",
  handler: async (ctx) => {
    const currencies = {}; // Cache currency data to avoid redundant lookups

    // Retrieve big wins data from the stats store
    const bigwins = api.get("stats", "bets", "bigwins");
    const top = _.chain(bigwins)
      .keys()
      .map((id) => bigwins[id])
      .filter(({ bet }) => _.keys(bet).length > 0)
      // Sort by winnings converted to USD
      .orderBy(({ bet }) => {
        const currency = currencies[bet.currency]
          ? currencies[bet.currency]
          : api.get("public", "currencies", bet.currency);
        if (!currency) return 0; // Skip invalid currencies

        currencies[bet.currency] ??= currency;

        // Convert from smallest unit to USD: (amount / 10^decimals) * price
        return (
          (bet.winnings / Math.pow(10, currency.decimals)) * currency.price
        );
      })
      .reverse()
      .uniqBy("userid") // One entry per player
      .take(10)
      // Convert bet amounts and winnings to USD for display
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

    // Non-Discord platforms use the model formatter
    if (ctx.platform !== "discord") {
      return ctx.sendForm(models.bigwins(top));
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
      title: "Big Wins",
      content,
    });
  },
});
