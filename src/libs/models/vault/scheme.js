const assert = require("assert");
const _ = require("lodash");
const Humanize = require("humanize-plus");
const { formatCurrency } = require("@coingecko/cryptoformat");

module.exports = ({
  currencies,
  distributeAt,
  totalMinted,
  totalStaked,
  totalValue,
  perThousand,
}) => {
  const today = new Date();
  //today.setHours(today.getHours() - 1); // REMOVE FOR SUMMER TIME
  const endDate = new Date(parseFloat(distributeAt));

  var days = parseInt((endDate - today) / (1000 * 60 * 60 * 24));
  var hours = parseInt((Math.abs(endDate - today) / (1000 * 60 * 60)) % 24);
  var minutes = parseInt(
    (Math.abs(endDate.getTime() - today.getTime()) / (1000 * 60)) % 60
  );

  const content = _.chain(currencies)
    .sortBy((curr) => curr.value * curr.price)
    .reverse()
    .map(({ name, value, price }) => {
      const balance = value * price;
      const isUnderline = (content, balanceValue) =>
        balanceValue < 0 ? `<s>${content}</s>` : content;

      if (_.startsWith(name, "USD") || _.endsWith(name, "USD")) {
        return isUnderline(
          `${name}: ${formatCurrency(balance, "USD", "en")}`,
          balance
        );
      }
      return isUnderline(
        `${name}: ${Humanize.formatNumber(value, 2)} (${formatCurrency(
          balance,
          "USD",
          "en"
        )})`,
        balance
      );
    })
    .join("\n")
    .value();

  return {
    emoji: "💰",
    title: "The Vault",
    content: `${content}

**Total value: ${formatCurrency(totalValue, "USD", "en")}**
Distribution per 1000 CHIPS: ${formatCurrency(perThousand, "USD", "en")}
Total CHIPS minted: ${Humanize.formatNumber(totalMinted, 2)}
Total CHIPS locked: ${Humanize.formatNumber(totalStaked, 2)}

**Next distribution in:**
${hours} hours and ${minutes} minutes`,
    url: "https://chips.gg/vault",
    buttonLabel: "💰 GO TO VAULT 💰",
  };
};
