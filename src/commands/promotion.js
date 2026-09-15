/**
 * Promotion Command
 * Displays a single promotion's banner image by its promotion ID.
 * Fetches promotion details from the public API and renders the
 * banner from stats.chips.gg with a link to the promotion page.
 */
const { ApplicationCommandOptionType } = require("discord.js");
const { arg } = require("../libs/utils");

module.exports = (api) => ({
  name: "promotion",
  description: "Show promotion banner. Usage: /promotion promotionid",
  options: {
    promotionid: {
      description: "Promotion ID",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  },
  handler: async (ctx) => {
    const promotionId = arg(ctx, "promotionid", 1);
    if (!promotionId) {
      return ctx.sendText(
        "Please provide a promotion ID. Usage: /promotion promotionid"
      );
    }

    try {
      // Fetch promotion details from the public API
      const promotion = await api._actions.public("getPromotion", {
        // game: "promotion",
        gameid: promotionId, // roomid replaced with gameid when old game
      });

      // Display the promotion banner with a link to the full page
      return ctx.sendForm({
        emoji: "🎉",
        title: promotion.title,
        banner: `https://stats.chips.gg/promotions/${promotionId}`,
        buttonLabel: "View Promotion",
        url: `https://chips.gg/promotions/${promotionId}`,
      });
    } catch (e) {
      return ctx.sendText("Error searching promotions: " + e.message);
    }
  },
});
