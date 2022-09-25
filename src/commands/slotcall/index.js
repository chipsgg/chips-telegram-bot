const _ = require("lodash");
module.exports = (context) => {
  const { API, models } = context;
  return {
    slotcall: {
      description: "Get a random slot",
      handler: (ctx) => {
        const slot = API.getRandomSlot();
        ctx.sendForm(
          models.slotcall({
            ...slot,
            url: `https://chips.gg/casino/${slot.id}`,
          })
        );
      },
    },
  };
};
