const _ = require("lodash");
module.exports = (context) => {
  const { API, models } = context;
  return {
    bigwins: {
      description: "Ranking of players with big wins",
      handler: (ctx) => {
        const bigwins = API.get("stats", "bets", "bigwins");
        const top = _.chain(bigwins)
          .keys()
          .map((id) => bigwins[id])
          .filter(({ bet }) => _.keys(bet).length > 0)
          .orderBy(({ bet }) => {
            const { decimals } = API.get("public", "currencies", bet.currency);
            return bet.winnings / Math.pow(10, decimals);
          })
          .reverse()
          .uniqBy("userid")
          .take(10)
          .map((obj) => {
            const { price, decimals } = API.get(
              "public",
              "currencies",
              obj.bet.currency
            );
            obj.bet.amountInDollar =
              (obj.bet.amount / Math.pow(10, decimals)) * price;
            obj.bet.winningsInDollar =
              (obj.bet.winnings / Math.pow(10, decimals)) * price;
            return obj;
          })
          .value();
        ctx.sendForm(models.bigwins(top));
      },
    },
  };
};
