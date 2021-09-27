const assert = require('assert')
const _ = require('lodash')

module.exports = ({name, product, rtp, url_thumb}) => {
  return `
🎰 <strong>Chips Casino Slot Call</strong> 🎰 
🎩 ${name} 
🎩 ${product}
🎩 RTP ${rtp}% 
  
Good Luck and may the Chips be forever stacked in your favour ⭐️`
}