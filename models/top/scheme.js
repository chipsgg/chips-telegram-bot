const assert = require('assert')
const _ = require('lodash')
const { formatCurrency } = require('@coingecko/cryptoformat')

module.exports = (races) => {
  assert(races, "requires races")
  assert(races.length > 0, "requires at least one race")
  return _.chain(races)
    .map((race) => {
      const content = `<strong>${race.title}</strong>
<a href='https://chips.gg/event/${race.id}'><strong>View event</strong></a>

<strong>Current Top 10:</strong>
${_.chain(race.ranks)
          .take(10)
          .map((rank, index) => {
            const user = `<a href='https://chips.gg/games/home?modal=PlayerProfile&userid=${rank.user.id}'>${rank.user.username}</a>`
            // TODO: Simplify with Lodash _.isEmpty
            const isMultiplier = typeof (rank.multiplier) !== 'undefined' && rank.multiplier !== '' && typeof (rank.bet) !== 'undefined' && rank.bet !== null && typeof (rank.bet.slotname) !== 'undefined' && rank.bet.slotname !== ''
            const isWagered = typeof (rank.wagered) !== 'undefined' && rank.wagered > 0
            let info = null
            if (isMultiplier) {
              info = `<strong>${rank.multiplier}x</strong> @ ${rank.bet.slotname}`
            } else if (isWagered) {
              info = `${formatCurrency(_.toString(rank.wagered / 1000000), "USD", "en")}`
            } else {
              info = `${rank.score}`
            }
            return `<strong>${index + 1}.</strong> ${user}, ${info}`
          })
          .join("\n")
          .value()
        }\n\n`
      return content
    })
    .join('\n')
    .value()
}