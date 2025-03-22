module.exports = () => ({
  name: "koth",
  description: "Display current King of the Hill information",
  handler: async (ctx) => {
    // const koth = api.get('public', 'koth');

    return ctx.sendForm({
      emoji: "👑",
      title: "KING OF THE HILL",
      banner: `https://stats.chips.gg/koth`,
      buttonLabel: "BE KING.",
      url: "https://chips.gg/koth",
    });
  },
});
