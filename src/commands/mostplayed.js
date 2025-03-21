module.exports = (api) => ({
  name: "mostplayed",
  description: "List most played games",
  handler: async (ctx) => {
    const games = await api._actions.public("listGamesMostPlayed", {
      skip: 0,
      limit: 10,
      duration: "1m",
    });

    return ctx.sendForm({
      emoji: "🎮",
      title: "Most Played Games",
      content: games
        .map((game, index) => `${index + 1}. ${game.title} (${game.provider})`)
        .join("\n"),
      url: "https://chips.gg/casino",
      buttonLabel: "Play Now",
    });
  },
});
