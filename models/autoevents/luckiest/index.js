const _ = require('lodash')
const Humanize = require('humanize-plus')
const { formatCurrency } = require('@coingecko/cryptoformat')

module.exports = ({ slotname, multiplier, amount, currency, currencyInfo, winnings }) => {
  const amountValue = parseFloat(Humanize.formatNumber(amount / Math.pow(10, currencyInfo.decimals), currencyInfo.decimals))
  const winningsValue = parseFloat(Humanize.formatNumber(winnings / Math.pow(10, currencyInfo.decimals), currencyInfo.decimals))
  return `🍀🍀 <strong>Lucky Win Alert</strong> 🍀🍀

🕹️ ${slotname}
🤞 ${amountValue} ${_.upperCase(currency)} (${amountValue * currencyInfo.price})
💰 ${formatCurrency(winningsValue * currencyInfo.price, "USD", "en")}

✖️ <strong>${Humanize.formatNumber(multiplier, 2)}x Multiplier</strong>

Congratulations on your lucky win 🎉`
}