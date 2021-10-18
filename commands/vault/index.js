const _ = require('lodash');
// it will be changed with the future universal message system
const message_config = {
  parse_mode: "HTML",
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "💰 GO TO VAULT 💰",
          url: `https://chips.gg/vault`,
        },
      ]
    ],
  },
  disable_notification: true
};
module.exports = (context) => {
  const { API, models } = context;
  let last_divs = null;
  return {
    vault: {
      description: "The vault and rewards related",
      onlyAdmin: false,
      handler: (ctx) => {
        const doWork = () => {
          const distributeAt = API.get('profitshare', 'profitshareInfo', 'distributeAt');
          const totalMinted = API.get('profitshare', 'profitshareInfo', 'totalMinted') / 1000000;
          const totalStaked = API.get('profitshare', 'profitshareInfo', 'totalStaked') / 1000000;
          const currencies = _.chain(API.get('public', 'currencies'))
            .filter(({ name, hidden }) => !hidden && !_.includes(name, ['chips', 'chips_staking']))
            .map(({ name, price, decimals }) => ({
              name: _.upperCase(name),
              value: (API.get('profitshare', 'profitshareBalance', name) / Math.pow(10, decimals)) || 0,
              price: price || 1
            }))
            .value();
          const totalValue = _.chain(currencies)
            .filter(({ value }) => value > 0.0)
            .sumBy(({ value, price }) => value * price)
            .value();
          const perThousand = ((totalValue / 4) / totalStaked) * 100;
          return { currencies, distributeAt, totalMinted, totalStaked, totalValue, perThousand };
        }

        let lastContent = models.divs(doWork());
        ctx.reply(lastContent, message_config)
          .then(newCtx => {
            if (last_divs) clearInterval(last_divs);
            last_divs = setInterval(async () => {
              const content = models.divs(doWork())
              if (content !== lastContent) {
                try {
                  await ctx.telegram.editMessageText(newCtx.chat.id, newCtx.message_id, undefined, content, message_config);
                  lastContent = content;
                } catch (e) {
                  clearInterval(last_divs);
                };
              };
            }, 3000);
          });
      }
    }
  };
};