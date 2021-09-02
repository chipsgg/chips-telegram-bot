const assert = require('assert')
const _ = require('lodash')
const { formatDate } = require('../../utils')

module.exports = ({ distributeAt, totalMinted, totalStaked }) => { 

  const today = new Date();
  //today.setHours(today.getHours() - 1); // REMOVE FOR SUMMER TIME
  const endDate = new Date(parseFloat(distributeAt));

  var days = parseInt((endDate - today) / (1000 * 60 * 60 * 24));
  var hours = parseInt(Math.abs(endDate - today) / (1000 * 60 * 60) % 24);
  var minutes = parseInt(Math.abs(endDate.getTime() - today.getTime()) / (1000 * 60) % 60);
  return `<strong>The Vault</strong>
  
<strong>Total value: ${0}</strong>
Distribution per 1000 CHIPS: ${0}
Total CHIPS minted: ${totalMinted/1000000}
Total CHIPS locked: ${totalStaked/1000000}

<strong>Next distribution in: </strong>
${hours} hours and ${minutes} minutes
`
}