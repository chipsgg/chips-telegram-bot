
const { formatDate } = require("../../utils");

module.exports = (koth) => {
  if (!koth) {
    return {
      emoji: "👑",
      title: "KING OF THE HILL",
      content: "No active King of the Hill challenge!",
      buttonLabel: "Join KOTH",
      url: "https://chips.gg/koth"
    };
  }

  return {
    emoji: "👑",
    title: "KING OF THE HILL",
    content: [
      `👑 **Current King**: ${king?.username || 'No King Yet'}`,
      `💰 **Prize**: $${parseFloat(winnings).toLocaleString()} ${currency.toUpperCase()}`,
      `🎮 **Game**: ${game?.title || 'Unknown'}`,
      `🎯 **Multiplier**: ${multiplier}x`,
      `💵 **Minimum Bet**: $${parseFloat(minBet).toLocaleString()} ${currency.toUpperCase()}`,
      `📊 **Stats**:`,
      `• Total Bets: ${totalBets.toLocaleString()}`,
      winningBet ? `• Winning Bet: $${parseFloat(winningBet.amount).toLocaleString()}` : '',
      `⏰ **Time Left**: ${formatDate(endTime)}`,
      `🏆 **Status**: ${gameState.toUpperCase()}`,
    ].filter(Boolean).join('\n'),
    buttonLabel: "Join KOTH",
    url: "https://chips.gg/koth"
  };
};
