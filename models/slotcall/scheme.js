const assert = require('assert')
const _ = require('lodash')
const Humanize = require('humanize-plus')

module.exports = ({name, product, rtp, url_thumb}) => {
  return `
🎰 <strong>Chips Casino Slot Call</strong> 🎰 
🎩 ${name} 
🎩 ${product}
🎩 RTP ${Humanize.formatNumber(rtp,2)}% 
  
Good Luck and may the Chips be forever stacked in your favour ⭐️`
}