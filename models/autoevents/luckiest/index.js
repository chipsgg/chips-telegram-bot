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
    emoji: "đ",
    title: "Lucky Win Alert",
    content: `đšī¸ ${slotname}
đ¤ ${convertDecimals(amountValue, currencyInfo.decimals)} ${_.upperCase(
      currency
    )}
đ° ${convertDecimals(winningsValue, currencyInfo.decimals)} ${_.upperCase(
      currency
    )}

âī¸ **${Humanize.formatNumber(multiplier, 2)}x Multiplier**`,
    url,
    banner,
    buttonLabel: "đŠ PLAY NOW đŠ",
    footer: "Congratulations on your lucky win! đ",
  };
};
