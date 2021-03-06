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
    emoji: "đ¨",
    title: "Big Win Alert",
    content: `đšī¸ ${slotname}
âī¸ Multiplier ${Humanize.formatNumber(multiplier, 2)}x
đ¤ ${convertDecimals(amountValue, currencyInfo.decimals)} ${_.upperCase(
      currency
    )}

đ° **${convertDecimals(winningsValue, currencyInfo.decimals)} ${_.upperCase(
      currency
    )}** đ°`,
    banner,
    url,
    buttonLabel: "đŠ PLAY NOW đŠ",
    footer: "Congratulations to the lucky player on their big win! đ",
  };
};
