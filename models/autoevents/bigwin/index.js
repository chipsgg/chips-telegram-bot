const _ = require('lodash')
const Humanize = require('humanize-plus')
//const { formatCurrency } = require('@coingecko/cryptoformat')
const { convertDecimals } = require('../../../utils')

module.exports = ({ slotname, multiplier, amount, currency, currencyInfo, winnings }) => {
  const amountValue = parseFloat(Humanize.formatNumber(amount / Math.pow(10, currencyInfo.decimals), currencyInfo.decimals))
  const winningsValue = parseFloat(Humanize.formatNumber(winnings / Math.pow(10, currencyInfo.decimals), currencyInfo.decimals))
  return `🚨🚨 <strong>Big Win Alert</strong> 🚨🚨

🕹️ ${slotname}
✖️ Multiplier ${Humanize.formatNumber(multiplier, 2)}x
🤞 ${convertDecimals(amountValue, currencyInfo.decimals)} ${_.upperCase(currency)}

💰 <strong>${convertDecimals(winningsValue, currencyInfo.decimals)} ${_.upperCase(currency)}</strong> 💰

Congratulations to the lucky player on their big win!`
}