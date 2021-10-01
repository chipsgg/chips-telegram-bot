const assert = require('assert')
const _ = require('lodash')
const Humanize = require('humanize-plus')
const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')
dayjs.extend(relativeTime)

module.exports = ({ user_name, title, game_name, viewer_count, started_at }) => (`🚨 <strong>${user_name} LIVE ON CHIPS</strong> 🚨

🕹 Playing ${game_name}
🎩 ${Humanize.compactInteger(viewer_count, 2)} Viewers
⏰ Live for ${dayjs().to(dayjs(started_at))} 

🔞 This stream is 18+

Join the stream now to chat, watch the big wins roll in and have some fun 🎉`);