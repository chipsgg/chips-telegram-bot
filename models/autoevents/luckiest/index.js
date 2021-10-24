const _ = require('lodash')
const Humanize = require('humanize-plus')
//const { formatCurrency } = require('@coingecko/cryptoformat')
const { convertDecimals } = require('../../../utils')

module.exports = ({ slotname, multiplier, amount, currency, currencyInfo, winnings, banner, url }) => {
  const amountValue = amount / Math.pow(10, currencyInfo.decimals)
  const winningsValue = winnings / Math.pow(10, currencyInfo.decimals)
  return {
    emoji: "🍀", 
    title: "Lucky Win Alert", 
    content: `🕹️ ${slotname}
🤞 ${convertDecimals(amountValue, currencyInfo.decimals)} ${_.upperCase(currency)}
💰 ${convertDecimals(winningsValue, currencyInfo.decimals)} ${_.upperCase(currency)}

✖️ **${Humanize.formatNumber(multiplier, 2)}x Multiplier**`,
    url,
    banner,
    buttonLabel: '🎩 PLAY NOW 🎩',
    footer: 'Congratulations on your lucky win! 🎉'
  }
}