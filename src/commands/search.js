const { ApplicationCommandOptionType } = require("discord.js");

module.exports = (api) => ({
  name: "search",
  description: "Search the game catalog. Usage: /search game_name",
  options: {
    query: {
      description: "Search query",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  },
  handler: async (ctx) => {
    let query = null;
    if (ctx.platform === "discord" || ctx.platform === "api") {
      query = ctx?.getString("query");
    } else {
      query = ctx?.getArg(1);
    }

    if (!query) {
      return ctx.sendText(
        "Please provide a search query. Usage: /search game_name"
      );
    }

    try {
      const games = await api._actions.public("searchGames", {
        skip: 0,
        limit: 5,
        term: query,
      });

      if (!games || games.length === 0) {
        return ctx.sendForm({
          emoji: "🎮",
          title: "Game Search",
          content: "No games found matching your search.",
          url: "https://chips.gg/casino",
          buttonLabel: "Browse Games",
        });
      }

      const gameList = games
        .map(
          (game, index) =>
            `${index + 1}. ${game.title} (${game.provider})\n   ID: ${game.id}`
        )
        .join("\n");

      return ctx.sendForm({
        emoji: "🎮",
        title: "Game Search Results",
        content: `Found ${games.length} games matching "${query}":\n\n${gameList}`,
        url: "https://chips.gg/casino",
        buttonLabel: "Play Now",
      });
    } catch (error) {
      return ctx.sendText("Error searching games: " + error.message);
    }
  },
});
