const _ = require("lodash");
const Humanize = require("humanize-plus");

module.exports = ({ id, title, producer, rtp, images }) => ({
  emoji: "🎰",
  title: "Chips Casino Slot Call",
  content: `🎩 ${title}
🎩 ${producer}
🎩 RTP ${Humanize.formatNumber(rtp, 2)}%`,
  footer: "Good Luck and may the Chips be forever stacked in your favour ⭐️",
  banner: images.s2,
  url: `https://chips.gg/play/${id}`,
  buttonLabel: "🎰 PLAY NOW 🎰",
});
