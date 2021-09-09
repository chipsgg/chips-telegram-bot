const assert = require('assert')
const _ = require('lodash')
const Humanize = require('humanize-plus')
const { formatCurrency } = require('@coingecko/cryptoformat')

module.exports = ({ currencies, distributeAt, totalMinted, totalStaked, totalValue, perThousand }) => { 

  const today = new Date();
  //today.setHours(today.getHours() - 1); // REMOVE FOR SUMMER TIME
  const endDate = new Date(parseFloat(distributeAt));

  var days = parseInt((endDate - today) / (1000 * 60 * 60 * 24));
  var hours = parseInt(Math.abs(endDate - today) / (1000 * 60 * 60) % 24);
  var minutes = parseInt(Math.abs(endDate.getTime() - today.getTime()) / (1000 * 60) % 60);
  
  const content = _.chain(currencies)
    .map(({ name, value, rate }) => {
      if(_.startsWith(name, "USD") || _.endsWith(name, "USD")){
        return  `${name}: ${formatCurrency(value * rate, "USD", "en")}`
      }
      return `${name}: ${Humanize.formatNumber(value, 2)} (${formatCurrency(value * rate, "USD", "en")})`
    })
    .join('\n')
    .value();
  return `<strong>The Vault</strong>
${content}

<strong>Total value: ${formatCurrency(totalValue, "USD", "en")}</strong>
Distribution per 1000 CHIPS: ${formatCurrency(perThousand, "USD", "en")}
Total CHIPS minted: ${Humanize.formatNumber(totalMinted, 2)}
Total CHIPS locked: ${Humanize.formatNumber(totalStaked, 2)}

<strong>Next distribution in: </strong>
${hours} hours and ${minutes} minutes
`
}