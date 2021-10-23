const assert = require('assert')
const _ = require('lodash')
const { formatDate } = require('../../utils')
module.exports = (events) => ({
    emoji: "✨", 
    title: "ONGOING EVENTS", 
    content: events.length > 0 ? _.chain(events)
    .map(({ title, endTime, subtitle }) => (`---------
**${_.trim(title)}**
**Ends:** ${formatDate(endTime)}

*${_.trim(subtitle)}*`))
    .join("\n")
    .value(): '**There are no races at the moment!**',
    url: 'https://chips.gg/events',
    buttonLabel: '✨ GO TO EVENTS ✨'
})