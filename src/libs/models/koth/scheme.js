
const { formatDate } = require("../../utils");

module.exports = (koth) => ({
  emoji: "👑",
  title: "KING OF THE HILL",
  content: koth ? [
    `👑 **Current King**: ${koth.creator.username}`,
    `💰 **Prize Pool**: $${parseFloat(koth.amount).toLocaleString()} ${koth.currency.toUpperCase()}`,
    `🎮 **Game**: ${koth.catalogGame.title}`,
    `📊 **Stats**:`,
    `• Total Bets: ${koth.totalBets.toLocaleString()}`,
    `• Total Wagered: $${parseFloat(koth.totalWageredUsd).toLocaleString()}`,
    `• Total Won: $${parseFloat(koth.totalWonUsd).toLocaleString()}`,
    `⏰ **Ends**: ${formatDate(koth.endTime)}`,
  ].join('\n') : "No active King of the Hill challenge!",
  buttonLabel: "Join KOTH",
  url: "https://chips.gg/koth"
});
