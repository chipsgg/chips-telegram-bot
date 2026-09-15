const models = require("../libs/models");
const _ = require("lodash");

module.exports = (api) => ({
  name: "vault",
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
});
