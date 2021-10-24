const assert = require('assert')
const _ = require('lodash')
const { formatCurrency } = require('@coingecko/cryptoformat')

module.exports = (prices) => {
  assert(prices, "requires prices")
  assert(prices.length > 0, "requires at least one price")
  const content = _.chain(prices)
    .sortBy('price')
    .reverse()
    .map(({ name, price }) => (`${_.upperCase(name)}/USD: ${formatCurrency(price, "USD", "en")}`))
    .join("\n")
    .value()
  return {
    emoji: "📈", 
    title: "Market prices", 
    content
  }
}