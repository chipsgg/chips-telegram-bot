const _ = require('lodash');
module.exports = (context) => {
  const { API, models } = context;
  let last_prices = null;
  return {
    prices: {
      description: "The different cryptocurrencies and their values in dollars",
      onlyAdmin: false,
      handler: (ctx) => {
        const doWork = () => _.chain(API.get('public', 'currencies'))
          .filter(x => !x.hidden && x.name !== 'chips' && x.name !== "chips_staking" && !_.startsWith(x.name, "usd") && !_.endsWith(x.name, "usd"))
          .value();
        let lastContent = models.prices(doWork());
        ctx.replyWithHTML(lastContent, { disable_notification: true })
          .then(newCtx => {
            if (last_prices) clearInterval(last_prices);
            last_prices = setInterval(async () => {
              const content = models.prices(doWork());
              if (content !== lastContent) {
                try {
                  await ctx.telegram.editMessageText(newCtx.chat.id, newCtx.message_id, undefined, content, {
                    parse_mode: "HTML",
                    disable_notification: true
                  });
                  lastContent = content;
                } catch (e) {
                  clearInterval(last_prices);
                };
              };
            }, 4000);
          });
      }
    }
  };
};