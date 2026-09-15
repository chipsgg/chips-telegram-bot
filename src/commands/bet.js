/**
 * Bet Command
 * Displays a bet card/banner image for a specific bet by its ID.
 * The banner image is fetched from stats.chips.gg/bets/{betId}.
 */
const { ApplicationCommandOptionType } = require("discord.js");
const { arg } = require("../libs/utils");

module.exports = () => ({
  name: "bet",
  description: "Show bet card. Usage: /bet betid",
  options: {
    betid: {
      description: "Bet ID",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  },
  handler: async (ctx) => {
    const betId = arg(ctx, "betid", 1);
    if (!betId) {
      return ctx.sendText("Please provide a bet ID. Usage: /bet betid");
    }

    // Display the bet card banner image
    return ctx.sendForm({
      emoji: "🎲",
      title: `Bet: ${betId}`,
      banner: `https://stats.chips.gg/bets/${betId}`,
      // buttonLabel: "View Bet",
      // url: `https://chips.gg/bets/${betId}`,
    });
  },
});
