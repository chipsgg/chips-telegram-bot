const _ = require('lodash')
const Humanize = require('humanize-plus')
const { formatCurrency } = require('@coingecko/cryptoformat')

module.exports = ({ slotname, multiplier, amount, currency, currencyInfo, winnings }) => {
  return `🍀🍀 <strong>Lucky Win Alert</strong> 🍀🍀

🕹 ${slotname}
🔥 ${Humanize.toFixed(amount / Math.pow(10, currencyInfo.decimals), currencyInfo.decimals)} ${_.upperCase(currency)}
💰 ${formatCurrency((winnings / Math.pow(10, currencyInfo.decimals)) * currencyInfo.price, "USD", "en")}

✖️ <strong>${Humanize.formatNumber(multiplier, 2)}x Multiplier</strong>

Congratulations on your lucky win 🎉`
}