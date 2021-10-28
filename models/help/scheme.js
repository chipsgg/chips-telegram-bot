const _ = require("lodash");
module.exports = (commands) => ({
  emoji: "ℹ️",
  title: "Helper",
  content: _.chain(commands)
    .keys()
    .map((name) => ({ ..._.get(commands, name), name }))
    .map(({ name, description }) => `/${name} - ${description}`)
    .join("\n")
    .value(),
});
