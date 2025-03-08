const _ = require("lodash");
const { formatDate } = require("../../utils");

module.exports = (events) => ({
  emoji: "✨",
  title: "ONGOING EVENTS",
  content:
    events.length > 0
      ? _.chain(events)
          .map(
            ({ title, endTime, subtitle }) =>
              `🎮 **${_.trim(title)}**\n` +
              `⏰ Ends: ${formatDate(endTime)}\n` +
              `📝 ${_.trim(subtitle)}\n` +
              `━━━━━━━━━━━━━━━━━━`
          )
          .join("\n\n")
          .value()
      : "**There are no active events at the moment!** 😴",
  url: "https://chips.gg/events",
  buttonLabel: "✨ VIEW EVENTS ✨",
});
