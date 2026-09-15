/**
 * Promotions Command
 * Lists all currently running promotions and events on Chips.gg.
 * Fetches active promotions from the public API and formats them
 * using the events model.
 */
const models = require("../libs/models");

module.exports = (api) => ({
  name: "promotions",
  description: "Ongoing promotions and events",
  handler: async (ctx) => {
    // Fetch all currently active promotions
    const activeRaces = await api._actions.public("listRunningPromotions");
    return ctx.sendForm(models.events(activeRaces));
  },
});
