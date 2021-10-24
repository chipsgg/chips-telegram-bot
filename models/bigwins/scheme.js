const assert = require('assert')
const _ = require('lodash')
const { formatCurrency } = require('@coingecko/cryptoformat')
const Humanize = require('humanize-plus')

module.exports = (top) => {
  return `
🎰 <strong>Big wins</strong> 🎰 
${_.chain(top)
  .map((item, index) => `<strong>${index+1}</strong>. ${item.player.username}, ${formatCurrency(item.bet.amountInDollar, "USD", "en")} -> ${formatCurrency(item.bet.winningsInDollar, "USD", "en")} (<i>x${Humanize.formatNumber(item.bet.multiplier, 2)}</i>)`)
  .join('\n')
  .value()}`
}