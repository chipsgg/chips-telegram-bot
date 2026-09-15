/**
 * Search Command
 * Searches the Chips.gg game catalog by a query term.
 * Returns up to 5 matching games with their title, provider, and ID.
 */
const { ApplicationCommandOptionType } = require("discord.js");
const { arg } = require("../libs/utils");

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
    // Telegram: everything after the command is the query (multi-word titles)
    const query =
      ctx.platform === "telegram"
        ? ctx.getContent?.() ||
          [1, 2, 3, 4, 5]
            .map((i) => ctx.getArg(i))
            .filter(Boolean)
            .join(" ")
        : arg(ctx, "query", 1);

    if (!query) {
      return ctx.sendText(
        "Please provide a search query. Usage: /search game_name"
      );
    }

    try {
      // Search for games via the public API (limited to 5 results)
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

      // Title links to the play page; provider shown for disambiguation
      const gameList = games
        .map(
          (game, index) =>
            `${index + 1}. **[${game.title}](https://chips.gg/play/${game.slug || game.id})** — ${game.provider}`
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
