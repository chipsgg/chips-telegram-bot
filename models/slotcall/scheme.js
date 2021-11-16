const assert = require("assert");
const _ = require("lodash");
const Humanize = require("humanize-plus");

module.exports = ({ name, product, rtp, url, url_thumb }) => ({
  emoji: "🎰",
  title: "Chips Casino Slot Call",
  content: `🎩 ${name} 
🎩 ${product}
🎩 RTP ${Humanize.formatNumber(rtp, 2)}%`,
  footer: "Good Luck and may the Chips be forever stacked in your favour ⭐️",
  banner: url_thumb,
  url,
  buttonLabel: "🎰 PLAY NOW 🎰",
});
