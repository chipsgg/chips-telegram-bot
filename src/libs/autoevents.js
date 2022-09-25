const lodash = require("lodash");
const { Stack } = require("../../utils");

module.exports = (API) => {
  let cacheBigwins = new Stack(300);
  let cacheLuckiest = new Stack(300);

  function poll() {
    function parseNewData(cache, newData) {
      return lodash
        .chain(newData)
        .keys()
        .map((k) => lodash.get(newData, k))
        .filter(({ id }) => !lodash.includes(cache.stack, id))
        .value();
    }
    const filterEvents = (events, mMultiplier = 1.01) =>
      lodash
        .chain(events)
        .filter("bet.done")
        .filter("bet.win")
        .filter(({ bet }) => lodash.gte(bet.multiplier, mMultiplier))
        .filter(({ bet }) => {
          const currency = API.get("public", "currencies", bet.currency);
          const winnings =
            (bet.winnings / Math.pow(10, currency.decimals)) * currency.price;
          return winnings >= (process.env.alertMinimumDollar || 100);
        })
        .sortBy("bet.updated")
        .last()
        .value();
    const bigwins = parseNewData(
      cacheBigwins,
      API.get("stats", "bets", "bigwins")
    );
    const luckiest = parseNewData(
      cacheLuckiest,
      API.get("stats", "bets", "luckiest")
    );
    cacheBigwins.push(...lodash.map(bigwins, "id"));
    cacheLuckiest.push(...lodash.map(luckiest, "id"));
    return {
      bigwins: filterEvents(bigwins),
      luckiest: filterEvents(
        luckiest,
        process.env.alertMinimumMultiplier || 100
      ),
    };
  }
  return {
    poll,
  };
};
