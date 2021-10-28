module.exports = (context) => {
  const { API, models } = context;
  return {
    events: {
      description: "Ongoing events",
      handler: async (ctx) => {
        const activeRaces = await API.listActiveRaces((skip = 0), (limit = 10));
        ctx.sendForm(models.events(activeRaces));
      },
    },
  };
};
