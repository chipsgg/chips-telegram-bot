const _ = require('lodash');
module.exports = (context) => {
  const { API, models } = context;
  return {
    luckiest: {
      description: "Ranking of the luckiest players",
      onlyAdmin: false,
      handler: (ctx) => {
        const luckiest = API.get('stats', 'bets', 'luckiest');
        const top = _.chain(luckiest)
          .keys()
          .map(id => luckiest[id])
          .filter(obj => _.keys(obj.bet).length > 0)
          .orderBy(obj => obj.bet.multiplier)
          .reverse()
          .uniqBy('userid')
          .take(10)
          .map(obj => {
            const currency = API.get('public', 'currencies', obj.bet.currency);
            obj.bet.amountInDollar = (obj.bet.amount / Math.pow(10, currency.decimals)) * currency.price;
            obj.bet.winningsInDollar = (obj.bet.winnings / Math.pow(10, currency.decimals)) * currency.price;
            return obj;
          })
          .value();
        ctx.replyWithHTML(models.luckiest(top), { disable_notification: true });
      }
    }
  };
};