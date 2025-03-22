const { ApplicationCommandOptionType } = require("discord.js");

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
    let betId = null;
    if (ctx.platform === "discord") {
      betId = ctx?.getString("betid");
      if (!betId) {
        return ctx.sendText("Please provide a bet ID");
      }
    } else {
      betId = ctx?.getArg(1);
      if (!betId) {
        return ctx.sendText("Please provide a bet ID");
      }
    }

    return ctx.sendForm({
      emoji: "🎲",
      title: `Bet: ${betId}`,
      banner: `https://stats.chips.gg/bets/${betId}`,
      // buttonLabel: "View Bet",
      // url: `https://chips.gg/bets/${betId}`,
    });
  },
});
