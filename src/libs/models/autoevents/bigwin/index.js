const _ = require("lodash");
const Humanize = require("humanize-plus");
//const { formatCurrency } = require('@coingecko/cryptoformat')
const { convertDecimals } = require("../../../utils");

module.exports = ({
  slotname,
  multiplier,
  amount,
  currency,
  currencyInfo,
  winnings,
  banner,
  url,
}) => {
  const amountValue = amount / Math.pow(10, currencyInfo.decimals);
  const winningsValue = winnings / Math.pow(10, currencyInfo.decimals);
  return {
    emoji: "🚨",
    title: "Big Win Alert",
    content: `🕹️ ${slotname}
✖️ Multiplier ${Humanize.formatNumber(multiplier, 2)}x
🤞 ${convertDecimals(amountValue, currencyInfo.decimals)} ${_.upperCase(
      currency
    )}

💰 **${convertDecimals(winningsValue, currencyInfo.decimals)} ${_.upperCase(
      currency
    )}** 💰`,
    banner,
    url,
    buttonLabel: "🎩 PLAY NOW 🎩",
    footer: "Congratulations to the lucky player on their big win! 🎉",
  };
};
