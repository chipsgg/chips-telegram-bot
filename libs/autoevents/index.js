const _ = require('lodash')
const { Stack } = require('../../utils')
module.exports = (API) => {
  let cacheBigwins = new Stack(300);
  let cacheLuckiest = new Stack(300);

  function poll() {
    function parseNewData(cache, newData) {
      return _.chain(newData)
        .keys()
        .map(k => _.get(newData, k))
        .filter(({ id }) => !_.includes(cache.stack, id))
        .value();
    }
    const filterEvents = (events, mMultiplier = 1.01) => _.chain(events)
      .filter("bet.done")
      .filter("bet.win")
      .filter(v => _.gte(_.get(v, "bet.multiplier"), mMultiplier))
      .sortBy("bet.updated")
      .last()
      .value();
    const bigwins = parseNewData(cacheBigwins, API.get('stats', 'bets', 'bigwins'));
    const luckiest = parseNewData(cacheLuckiest, API.get('stats', 'bets', 'luckiest'));
    cacheBigwins.push(..._.map(bigwins, "id"));
    cacheLuckiest.push(..._.map(luckiest, "id"));
    return {
      bigwins: filterEvents(bigwins),
      luckiest: filterEvents(luckiest, 100)
    };
  }
  return {
    poll
  }
}
