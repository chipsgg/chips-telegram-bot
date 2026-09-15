/**
 * Command Loader and Registry
 * Registers the built-in help command and dynamically loads all command
 * modules from the src/commands directory into a unified commands map.
 */
const assert = require("assert");
const _ = require("lodash");
const models = require("./models");

module.exports = (api) => {
  assert(api, "requires api");

  const commands = {};

  // Register the help command inline so it has direct access to the commands map
  commands.help = {
    description: "Description of all commands",
    handler: (ctx) => ctx.sendForm(models.help(commands)),
  };

  const loadedCommands = loadCommands(api);
  Object.assign(commands, loadedCommands);

  console.log(`Loaded ${Object.keys(commands).length} commands!`);
  console.log(Object.keys(commands));

  return commands;
};

// Dynamically load all .js command files from the commands directory
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
