const _ = require("lodash");
const { formatDate, timeUntil } = require("../../utils");

// First non-empty line of the promo description, trimmed to one sentence-ish.
const summarize = (promo) => {
  const sub = _.trim(promo.subtitle);
  if (sub) return sub;
  const firstLine = _.chain(promo.description || "")
    .split("\n")
    .map(_.trim)
    .find((l) => l && !l.startsWith("#"))
    .value();
  if (!firstLine) return "";
  const clean = firstLine.replace(/[*_`#>]/g, "").trim();
  return clean.length > 140 ? `${clean.slice(0, 137)}...` : clean;
};

module.exports = (events) => ({
  emoji: "✨",
  title: "ONGOING EVENTS",
  content:
    events.length > 0
      ? _.chain(events)
          .sortBy("endTime")
          .map((promo) => {
            const summary = summarize(promo);
            return [
              `🎮 **[${_.trim(promo.title)}](https://chips.gg/promotions/${promo.promotionid})**`,
              `⏰ Ends ${timeUntil(promo.endTime)} (${formatDate(promo.endTime)})`,
              summary ? `📝 ${summary}` : null,
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n\n")
          .value()
      : "**There are no active events at the moment!** 😴",
  url: "https://chips.gg/promotions",
  buttonLabel: "✨ VIEW EVENTS ✨",
});
