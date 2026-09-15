/**
 * Promotions Command
 * Lists all currently running promotions and events on Chips.gg.
 */
const models = require("../libs/models");

module.exports = (api) => ({
  name: "promotions",
  description: "Ongoing promotions and events",
  handler: async (ctx) => {
    // The server destructures its params object; it must be `{}` not undefined.
    const running = await api._actions.public("listRunningPromotions", {});
    return ctx.sendForm(models.events(Array.isArray(running) ? running : []));
  },
});
