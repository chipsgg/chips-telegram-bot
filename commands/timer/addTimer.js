const _ = require('lodash');
module.exports = (context) => {
  const { API, models, modules } = context;
  const { Timer } = modules;
  return {
    description: "Add a new automated message",
    onlyAdmin: true,
    handler: (ctx) => {
      if (ctx.chat.type != "private") return;
      if (!ctx.from._is_in_admin_list) return;

      ctx.ask('What is the name of your timer?')
        .then(async result => {
          const name = result.message.text
          if (await Timer.getTimer(name)) {
            ctx.replyWithHTML(models.error("Error", "A timer already exists under the same name"));
            return;
          }
          ctx.ask('What is the message?')
            .then(result => {
              const message = {
                text: result.message.text,
                entities: result.message.entities
              };

              ctx.ask('What is the interval in minutes ?')
                .then(result => {
                  const interval = _.parseInt(result.message.text) || 1;
                  ctx.ask('What is the minimum number of lines?')
                    .then(result => {
                      const lineMinimum = _.parseInt(result.message.text) || 0;
                      Timer.addTimer(name, message, interval, lineMinimum)
                        .then(doc => ctx.replyWithHTML(models.timer.addTimer(doc)))
                        .catch((e) => ctx.replyWithHTML(models.error("Fatal", "An error has occurred")));
                    });
                });
            });
        });
    }
  };
};