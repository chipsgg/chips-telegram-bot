const models = require("../libs/models");

module.exports = (api) => ({
  name: "slotcall",
  description: "Get a random slot",
  handler: async (ctx) => {
    const slot = await api.getRandomSlot();

    return ctx.sendForm(
      models.slotcall({
        ...slot,
      })
    );
  },
});
