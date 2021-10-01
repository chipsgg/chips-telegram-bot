const assert = require('assert')
const _ = require('lodash')

module.exports = (streamers) => {
  assert(streamers, "requires streamers");
  const listStreamers = _.chain(streamers)
    .map(({ name, lastStatus, lastImpression }) => (`<a href='https://www.twitch.tv/${name}'><strong>${name}</strong></a>
${lastStatus}
`))
    .join("\n")
    .value()
  return `📺 <strong>Streamers</strong> 📺
${streamers.length > 0 ? listStreamers : '<i>No streamers, to add one do /addStreamer</i>'}`;
}