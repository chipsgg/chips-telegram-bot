const _ = require("lodash");
const {
  Client,
  Intents,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
} = require("discord.js");
const discordMakeForm = (options) => {
  const { emoji, title, content, footer, banner, url, buttonLabel } = options;
  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setStyle("LINK")
      .setLabel(buttonLabel || "Click on link")
      .setURL(url || "https://chips.gg/"),
  );
  const embed = new MessageEmbed()
    .setTitle(`${_.trim(emoji)} ${_.trim(title)} ${_.trim(emoji)}`)
    .setDescription(_.trim(content));
  if (footer)
    embed.setFooter(
      _.trim(footer),
      "https://cdn.chips.gg/public/images/assets/favicon/favicon-32x32.png",
    );
  if (banner) embed.setImage(banner);
  if (url) embed.setURL(url);
  return {
    content: " ",
    embeds: [embed],
    components: url && buttonLabel ? [row] : [],
  };
};

const WrapperDiscord = (context, client) => {
  console.log("WrapperDiscord", context);

  const sendForm = (...args) => {
    if (context.deferred || context.replied) {
      return context.editReply(discordMakeForm(...args));
    }
    return context.reply(discordMakeForm(...args));
  };
  const sendText = (content) => {
    if (context.deferred || context.replied) {
      return context.editReply({ content });
    }
    return context.reply({ content });
  };

  const getContent = () => context.message?.content || "";
  const getArg = (index) => getContent().split(" ")[index];
  const getString = (param) => context.options?.getString(param);

  return {
    platform: "discord",
    userid: context.user.id,
    guild: context.guild,
    sendForm,
    sendText,
    getString,
    getArg,
    getContent,
  };
};

module.exports = (token, commands) =>
  new Promise((resolve, reject) => {
    const client = new Client({
      intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_INTEGRATIONS,
      ],
    });
    client.on("ready", async () => {
      console.log(`[DISCORD]: Logged in as ${client.user.tag}!`);
      try {
        const commandData = _.map(_.keys(commands), (name) => {
          const command = commands[name];
          const options = [];

          if (name === "user" || name === "stats") {
            options.push({
              name: "username",
              description: "Username to look up",
              type: 3,
              required: true,
            });
          } else if (name === "auth" || name === "linkaccount") {
            options.push(
              {
                name: "username",
                description: "Your Chips.gg username",
                type: 3,
                required: true,
              },
              {
                name: "totp",
                description: "Your TOTP authentication code",
                type: 3,
                required: true,
              },
            );
          }

          return {
            name,
            description: command.description,
            options: options.length > 0 ? options : undefined,
          };
        });

        // // First, fetch all existing commands
        // const existingCommands = await client.application.commands.fetch();

        // // Delete existing commands with error handling
        // for (const command of existingCommands.values()) {
        //   try {
        //     await command.delete();
        //   } catch (error) {
        //     if (error.code === 10063) {
        //       console.log(`Command ${command.id} already deleted or doesn't exist`);
        //       continue;
        //     }
        //     throw error;
        //   }
        // }

        // Register all commands in one API call
        try {
          await client.application.commands.set(commandData);
          console.log("Successfully registered all commands");
        } catch (err) {
          console.error("Failed to register commands:", err);
          reject(err);
          return;
        }
        resolve({
          broadcastText,
          broadcastForm,
        });
      } catch (error) {
        console.error("Error registering application commands:", error);
        reject(error);
      }
    });

    client.on("interactionCreate", async (ctx) => {
      if (!ctx.isCommand()) return;
      if (!_.has(commands, ctx.commandName))
        return ctx.reply("the command does not exist");
      await ctx.deferReply();
      const wrapper = WrapperDiscord(ctx, client);

      await Promise.resolve(commands[ctx.commandName].handler(wrapper));
    });
    const broadcast = (form) => {
      try {
        client.guilds.cache.forEach((guild) => {
          const chan = guild.channels.cache
            .filter(
              (channel) =>
                channel.permissionsFor(client.user).has("SEND_MESSAGES") &&
                channel.isText(),
            )
            .first();
          if (chan) {
            chan.send(form).catch((e) => console.log("ERROR", e.message));
          }
        });
      } catch (e) {
        console.log("ERROR", e.message);
      }
    };
    const broadcastText = (message) => broadcast({ content: message });
    const broadcastForm = (...args) => broadcast(discordMakeForm(...args));
    client.login(token);
  });
