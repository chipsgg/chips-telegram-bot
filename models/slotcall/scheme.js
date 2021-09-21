const assert = require('assert')
const _ = require('lodash')

module.exports = ({name, product, rtp, url_thumb}) => {
  return `
🎰 ***Chips Casino Slot Call*** 🎰 
[ ](${url_thumb})
🎩 ${name} 
🎩 ${product}
🎩 RTP ${rtp}% 
  
Good Luck and may the Chips be forever stacked in your favour ⭐️`
}