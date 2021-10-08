const _ = require('lodash')
const Humanize = require('humanize-plus')
const { formatCurrency } = require('@coingecko/cryptoformat')

module.exports = ({ slotname, multiplier, amount, currency, currencyInfo, winnings }) => {
  return `🚨🚨 <strong>Big Win Alert</strong> 🚨🚨

🕹 ${slotname}
✖️ Multiplier ${Humanize.formatNumber(multiplier, 2)}x
🪙 ${amount / Math.pow(10, currencyInfo.decimals)} ${_.upperCase(currency)}

💰 <strong>${formatCurrency((winnings / Math.pow(10, currencyInfo.decimals)) * currencyInfo.price, "USD", "en")}</strong> 💰

Congratulations to the lucky player on their big win!`
}