module.exports = (context) => {
  const { API, models } = context;
  return {
    events: {
      description: "Ongoing events",
      onlyAdmin: false,
      handler: (ctx) => {
        API.listActiveRaces(skip = 0, limit = 10)
          .then(activeRaces => {
            ctx.replyWithHTML(models.events(activeRaces), {
              disable_web_page_preview: true,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✨ GO TO EVENTS ✨",
                      url: `https://chips.gg/events`,
                    },
                  ]
                ],
              },
              disable_notification: true
            });
          });
      }
    }
  };
};