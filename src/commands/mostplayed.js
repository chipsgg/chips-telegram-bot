/**
 * Most Played Command
 * Lists the top 10 most played games on Chips.gg in the last month.
 * On Discord and Telegram, game titles and providers are rendered as hyperlinks.
 * On other platforms, plain text formatting is used.
 */
module.exports = (api) => ({
  name: "mostplayed",
  description: "List most played games",
  handler: async (ctx) => {
    // Fetch top 10 most played games from the last month
    const games = await api._actions.public("listGamesMostPlayed", {
      skip: 0,
      limit: 10,
      duration: "1m",
    });

    // Use hyperlink formatting for platforms that support markdown
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

// Formats a game entry with markdown hyperlinks for Discord/Telegram
function hyperlinkMap(game, index) {
  return `${index + 1}. **[${game.title}](https://chips.gg/play/${game.slug})** by [${game.provider}](https://chips.gg/casino/providers/${game.provider})`;
}

// Formats a game entry as plain text for other platforms
function defaultMap(game, index) {
  return `${index + 1}. ${game.title} (${game.provider})`;
}
