const assert = require('assert')
const _ = require('lodash')

module.exports = (ambassadors) => {
  assert(ambassadors, "requires ambassadors");
  assert(ambassadors.length > 0, "requires at least one ambassador");
  const listAmbassadors = _.chain(ambassadors)
    .map(({ flag, username, country }) => `${flag}${flag}${flag} @${username} (${country})`)
    .join("\n")
    .value()
  return `MrChips has Ambassadors that speak the following Languages:\n\n${listAmbassadors}`;
}