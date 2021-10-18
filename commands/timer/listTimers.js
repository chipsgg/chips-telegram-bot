module.exports = (context) => {
  const { API, models, modules } = context;
  const { Timer } = modules;
  return {
    description: "List the existing timers with their parameters",
    onlyAdmin: true,
    handler: (ctx) => {
      if (ctx.chat.type != "private") return;
      if (!ctx.from._is_in_admin_list) return;

      Timer.listTimers()
        .then(timers => ctx.replyWithHTML(models.timer.listTimers(timers)));
    }
  };
};