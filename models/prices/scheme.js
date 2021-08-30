const assert = require('assert')
const _ = require('lodash')
const { formatCurrency } = require('@coingecko/cryptoformat')

module.exports = (prices) => {
  assert(prices, "requires prices")
  assert(prices.length > 0, "requires at least one price")
  const content = _.chain(prices)
    .map(({ pair1, pair2, price }) => (`${pair1}/${pair2}: ${formatCurrency(price, "USD", "en")}`))
    .join("\n")
    .value()
  return `<strong>Current prices:</strong>
${content}`
}