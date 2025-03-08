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
`,
    url: "https://chips.gg/vault",
    buttonLabel: "💰 GO TO VAULT 💰",
  };
};
