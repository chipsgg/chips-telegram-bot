const _ = require('lodash');
module.exports = (context) => {
  const { API, models } = context;
  return {
    slotcall: {
      description: "Get a random slot",
      onlyAdmin: false,
      handler: (ctx) => {
        const slot = API.getRandomSlot();
        ctx.replyWithPhoto({ url: slot.url_thumb }, {
          parse_mode: "HTML",
          caption: models.slotcall(slot),
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎰 PLAY NOW 🎰",
                  url: `https://chips.gg/casino/${slot.id}`,
                },
              ]
            ],
          },
          disable_notification: true
        });
      }
    }
  };
};