const models = require("../libs/models");

module.exports = (api) => ({
  name: "promotions",
  description: "Ongoing promotions and events",
  handler: async (ctx) => {
    const activeRaces = await api._actions.public("listRunningPromotions");
    return ctx.sendForm(models.events(activeRaces));
  },
});
