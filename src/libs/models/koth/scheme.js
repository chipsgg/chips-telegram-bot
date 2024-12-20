const { formatDate } = require("../../utils");
// const { convertDecimals } = require("../../../utils");

const Big = require("big.js");

function makeid(length = 10) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const sleep = (delay = 0) => new Promise((res) => setTimeout(res, delay));

const loop = async (fn, delay, ...args) => {
  do {
    await fn(...args);
    await sleep(delay);
    // eslint-disable-next-line no-constant-condition
  } while (true);
};

const convertDecimals = (amount, fromDecimals, toDecimals) => {
  if (isNaN(parseFloat(amount))) return;

  const diff = fromDecimals - toDecimals;

  // no difference to convert, return original value
  if (diff === 0) return amount;

  // server int format -> human, fixed to fromDecimals
  // decimal limit is 8
  if (diff > 0)
    return Big(amount)
      .div(Big(10).pow(diff))
      .toFixed(Math.min(8, fromDecimals), Big.roundDown);

  // human -> server int format, fixed to 0 decimal places
  return Big(amount)
    .times(Big(10).pow(Math.abs(diff)))
    .toFixed(0, Big.roundDown);
};

module.exports = (koth) => {
  if (!koth) {
    return {
      emoji: "👑",
      title: "KING OF THE HILL",
      content: "No active King of the Hill challenge!",
      buttonLabel: "Join KOTH",
      url: "https://chips.gg/koth",
    };
  }

  const {
    done,
    id,
    state: gameState,
    winningBet,
    king,
    created,
    updated,
    countdown,
    duration,
    multiplier,
    game,
    catalogid,
    endTime,
    currency,
    winnings,
    totalBets,
    minBet,
  } = koth || {};

  return {
    emoji: "👑",
    title: "KING OF THE HILL",
    content: [
      ...(winningBet
        ? [
            `🏆 **KING**:`,
            `• Username: ${king.username}`,
            `• Multiplier: ${winningBet.multiplier}x`,
          ]
        : []),
      `💰 **Prize**: $${convertDecimals(winnings, 6, 0).toLocaleString()} ${currency.toUpperCase()}`,
      `🎮 **Game**: ${game?.title || "Unknown"}`,
      `⏳  **Time Left**: ${formatDate(endTime)}`,
      `📈  **Multiplier**: ${multiplier}x`,
      `🚷  **Minimum Bet**: $${convertDecimals(minBet, 6, 0).toLocaleString()} ${currency.toUpperCase()}`,
      `🧮 Total Bets: ${totalBets.toLocaleString()}`,
    ]
      .filter(Boolean)
      .join("\n"),
    buttonLabel: "Join KOTH",
    url: `https://chips.gg/play/${catalogid}`,
  };
};
