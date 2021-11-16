const _ = require("lodash");
module.exports = (context) => {
  const { API, models } = context;
  return {
    prices: {
      description: "The different cryptocurrencies and their values in dollars",
      handler: (ctx) => {
        const content = _.chain(API.get("public", "currencies"))
          .filter(
            (x) =>
              !x.hidden &&
              x.name !== "chips" &&
              x.name !== "chips_staking" &&
              !_.startsWith(x.name, "usd") &&
              !_.endsWith(x.name, "usd")
          )
          .value();
        ctx.sendForm(models.prices(content));
      },
    },
  };
};
