const assert = require('assert')
const _ = require('lodash')
const { formatDate } = require('../../utils')
module.exports = (events) => {
  assert(events, "requires events")
  if (events.length > 0) {
    const content = _.chain(events)
      .map(({ title, endTime, subtitle }) => (`---------
<strong>${title}</strong>
<strong>Ends:</strong> ${formatDate(endTime)}

<em>${subtitle}</em>`))
      .join("\n")
      .value()
    // { title, endTime, subtitle }
    return `✨ <strong>ONGOING EVENTS</strong> ✨
${content}

---------
<a href="https://chips.gg/events">Click here to find out more about our events!</a>`
  } else {
    return "There are no races at the moment!"
  }
}
