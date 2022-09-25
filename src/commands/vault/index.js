const _ = require("lodash");

module.exports = (context) => {
  const { API, models } = context;
  return {
    vault: {
      description: "The vault and rewards related",
      handler: (ctx) => {
        const distributeAt = API.get(
          "profitshare",
          "profitshareInfo",
          "distributeAt"
        );
        const totalMinted =
          API.get("profitshare", "profitshareInfo", "totalMinted") / 1000000;
        const totalStaked =
          API.get("profitshare", "profitshareInfo", "totalStaked") / 1000000;
        const currencies = _.chain(API.get("public", "currencies"))
          .filter(
            ({ name, hidden }) =>
              !hidden && !_.includes(name, ["chips", "chips_staking"])
          )
          .map(({ name, price, decimals }) => ({
            name: _.upperCase(name),
            value:
              API.get("profitshare", "profitshareBalance", name) /
                Math.pow(10, decimals) || 0,
            price: price || 1,
          }))
          .value();
        const totalValue = _.chain(currencies)
          .filter(({ value }) => value > 0.0)
          .sumBy(({ value, price }) => value * price)
          .value();
        const perThousand = (totalValue / 4 / totalStaked) * 100;
        ctx.sendForm(
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
  };
};
