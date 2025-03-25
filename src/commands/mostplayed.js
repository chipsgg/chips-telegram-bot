module.exports = (api) => ({
  name: "mostplayed",
  description: "List most played games",
  handler: async (ctx) => {
    const games = await api._actions.public("listGamesMostPlayed", {
      skip: 0,
      limit: 10,
      duration: "1m",
    });

    const content =
      ctx.platform === "discord" || ctx.platform === "telegram"
        ? games.map(hyperlinkMap).join("\n")
        : games.map(defaultMap).join("\n");

    return ctx.sendForm({
      emoji: "🎮",
      title: "Most Played Games",
      content: content,
      url: "https://chips.gg/casino",
      buttonLabel: "Play Now",
    });
  },
});

function hyperlinkMap(game, index) {
  return `${index + 1}. **[${game.title}](https://chips.gg/play/${game.slug})** by [${game.provider}](https://chips.gg/casino/providers/${game.provider})`;
}

function defaultMap(game, index) {
  return `${index + 1}. ${game.title} (${game.provider})`;
}
