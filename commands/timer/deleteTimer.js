module.exports = (context) => {
  const { API, models, modules } = context;
  const { Timer } = modules;
  return {
    description: "Delete an automated message",
    onlyAdmin: true,
    handler: (ctx) => {
      if (ctx.chat.type != "private") return;
      if (!ctx.from._is_in_admin_list) return;
      ctx.ask('What\'s timer to delete?')
        .then(async result => {
          const name = result.message.text;
          if (!await Timer.getTimer(name)) {
            ctx.replyWithHTML(models.error("Error", "The timer does not exist"));
            return;
          }
          Timer.deleteTimer(name)
            .then(result => ctx.replyWithHTML(models.timer.deleteTimer(name, result)));
        });
    }
  };
};