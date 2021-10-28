const _ = require("lodash");

module.exports = (API) => {
  let lastBigwins = [];
  let lastLuckiest = [];

  function getKeysBigwins() {
    return _.keys(API.get("stats", "bets", "bigwins"));
  }
  function getKeysLuckiest() {
    return _.keys(API.get("stats", "bets", "luckiest"));
  }
  const init = () => {
    lastBigwins = getKeysBigwins();
    lastLuckiest = getKeysLuckiest();
  };
  const poll = () => {
    const bigwins =
      _.filter(
        getKeysBigwins(),
        (newKey) => !_.includes(lastBigwins, newKey)
      ) || [];
    const luckiest =
      _.filter(
        getKeysLuckiest(),
        (newKey) => !_.includes(lastLuckiest, newKey)
      ) || [];
    lastBigwins = _.takeRight([...lastBigwins, ...bigwins], 200);
    lastLuckiest = _.takeRight([...lastLuckiest, ...luckiest], 200);
    return {
      bigwins: _.map(bigwins, (key) =>
        API.get("stats", "bets", "bigwins", key)
      ),
      luckiest: _.map(luckiest, (key) =>
        API.get("stats", "bets", "luckiest", key)
      ),
    };
  };
  return {
    init,
    poll,
  };
};
