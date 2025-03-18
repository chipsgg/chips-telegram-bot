require("dotenv").config();
const { REST, Routes } = require("discord.js");
const Commands = require("./commands");

/*
 *	"yarn run deploy" - updates slash commands globally
 */

async function deploySlashCommands() {
  const commands = Commands({});

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  const json = Object.entries(commands).map(([name, command]) => {
    const options = [];

    for (const [name, settings] of Object.entries(command.options ?? {})) {
      const option = {
        name,
        description: settings.description,
        type: settings.type,
        required: settings.required,
      };
      options.push(option);
    }

    return {
      name,
      description: command.description,
      options: options.length > 0 ? options : undefined,
    };
  });

  console.log(`[DISCORD] Deploying slash commands...`);

  try {
    const { id } = await rest.get(Routes.currentApplication());
    await rest.put(Routes.applicationCommands(id), {
      body: json,
    });

    console.log(`[DISCORD] Updated ${json.length} slash commands globally`);
  } catch (error) {
    console.error(error);
  }
}

(async () => {
  if (process.argv[1].includes("deploy")) {
    await deploySlashCommands();
  }
})();
