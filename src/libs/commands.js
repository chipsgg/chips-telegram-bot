const assert = require("assert");
const _ = require("lodash");
const models = require("./models");

module.exports = (api) => {
  assert(api, "requires api");

  const commands = {};

  // Help command is defined here for easy access to the commands object
  commands.help = {
    description: "Description of all commands",
    handler: (ctx) => ctx.sendForm(models.help(commands)),
  };

  const loadedCommands = loadCommands(api);
  Object.assign(commands, loadedCommands);

  console.log(`Loaded ${Object.keys(commands).length} commands!`);

  return commands;
};

function loadCommands(api) {
  const fs = require("fs");
  const path = require("path");

  const commands = {};
  const dir = path.join(__dirname, "../commands");
  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (!file.endsWith(".js")) continue;

    try {
      const module = require(path.join(dir, file));
      const command = module(api);
      commands[command.name || file.replace(".js", "").trim()] = command;
    } catch (error) {
      console.error("Error loading command:", file, error);
    }
  }

  return commands;
}
