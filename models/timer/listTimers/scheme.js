const assert = require('assert')
const _ = require('lodash')

module.exports = (timers) => {
  assert(timers, "requires timers");
  const listTimers = _.chain(timers)
    .map(({ name, interval, lineMinimum }) => `<strong>${name}</strong>
Interval: ${interval} mins
lineMinimum: ${lineMinimum}
`)
    .join("\n")
    .value()
  return `⏰ <strong>Timers</strong> ⏰
${timers.length > 0?listTimers: '<i>No timers, to add one do /addTimer</i>'}`;
}