const assert = require('assert')
const _ = require('lodash')
const { formatCurrency } = require('@coingecko/cryptoformat')

module.exports = (top) => {
  return `
🎰 <strong>Luckiest players</strong> 🎰 
${_.chain(top)
  .map((item, index) => `<strong>${index+1}</strong>. ${item.player.username}, ${formatCurrency(item.bet.amountInDollar, "USD", "en")} -> ${formatCurrency(item.bet.winningsInDollar, "USD", "en")} (<i>x${item.bet.multiplier}</i>)`)
  .join('\n')
  .value()}`
}