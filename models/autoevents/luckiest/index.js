const _ = require('lodash')
const Humanize = require('humanize-plus')
//const { formatCurrency } = require('@coingecko/cryptoformat')
const { convertDecimals } = require('../../../utils')

module.exports = ({ slotname, multiplier, amount, currency, currencyInfo, winnings }) => {
  const amountValue = amount / Math.pow(10, currencyInfo.decimals)
  const winningsValue = winnings / Math.pow(10, currencyInfo.decimals)
  return `🍀🍀 <strong>Lucky Win Alert</strong> 🍀🍀

🕹️ ${slotname}
🤞 ${convertDecimals(amountValue, currencyInfo.decimals)} ${_.upperCase(currency)}
💰 ${convertDecimals(winningsValue, currencyInfo.decimals)} ${_.upperCase(currency)}

✖️ <strong>${Humanize.formatNumber(multiplier, 2)}x Multiplier</strong>

Congratulations on your lucky win 🎉`
}