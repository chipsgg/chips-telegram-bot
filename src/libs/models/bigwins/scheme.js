const assert = require("assert");
const _ = require("lodash");
const { formatCurrency } = require("@coingecko/cryptoformat");
const Humanize = require("humanize-plus");

module.exports = (top) => ({
  emoji: "🎰",
  title: "Big wins",
  content: _.chain(top)
    .map(
      (item, index) =>
        `**${index + 1}**. ${item.player.username}, ${formatCurrency(
          item.bet.amountInDollar,
          "USD",
          "en"
        )} -> ${formatCurrency(
          item.bet.winningsInDollar,
          "USD",
          "en"
        )} (*x${Humanize.formatNumber(item.bet.multiplier, 2)}*)`
    )
    .join("\n")
    .value(),
});
