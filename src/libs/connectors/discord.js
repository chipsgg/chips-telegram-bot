const _ = require("lodash");
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ButtonStyle,
} = require("discord.js");
const discordMakeForm = (options) => {
  const { emoji, title, content, footer, banner, url, buttonLabel } = options;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(buttonLabel || "Click on link")
      .setURL(url || "https://chips.gg/")
  );
  const embed = new EmbedBuilder().setTitle(
    `${_.trim(emoji)} ${_.trim(title)} ${_.trim(emoji)}`
  );

  // Only set description if content is not empty after trimming
  const trimmedContent = _.trim(content);
  if (trimmedContent) {
    embed.setDescription(trimmedContent);
  }
  if (footer)
    embed.setFooter({
      text: _.trim(footer),
      iconURL:
        "https://cdn.chips.gg/public/images/assets/favicon/favicon-32x32.png",
    });
  if (banner) embed.setImage(banner);
  if (url) embed.setURL(url);
  return {
    content: " ",
    embeds: [embed],
    components: url && buttonLabel ? [row] : [],
    ephemeral: options.ephemeral || false,
  };
};

const WrapperDiscord = (context, _client) => {
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
  const getNumber = (param) => context.options?.getNumber(param);

  return {
    platform: "discord",
    userid: context.user.id,
    guild: context.guild,
    sendForm,
    sendText,
    getString,
    getNumber,
    getArg,
    getContent,
    interaction: context,
  };
};

module.exports = (token, commands) =>
  new Promise((resolve, reject) => {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
    });

    client.on("ready", async () => {
      console.log(`[DISCORD]: Logged in as ${client.user.tag}!`);

      try {
        const commandData = _.map(_.keys(commands), (name) => {
          const command = commands[name];
          const options = [];

          for (const [name, settings] of Object.entries(
            command.options ?? {}
          )) {
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

        // Check if we need to register commands
        await client.application?.commands.fetch();
        let registrationNeeded = false;

        const existingCommandNames = client.application?.commands.cache.map(
          (c) => c.name
        );
        const newCommandNames = commandData.map((c) => c.name);

        // Check if the command list has changed
        if (
          existingCommandNames.length !== newCommandNames.length ||
          !newCommandNames.every((c) => existingCommandNames.includes(c))
        ) {
          registrationNeeded = true;
        } else {
          // Check if any command has changed. This only checks obvious changes like description or options length
          for (const command of commandData) {
            const existing = client.application.commands.cache.find(
              (c) => c.name === command.name
            );

            if (
              !existing ||
              existing.description !== command.description ||
              (existing.options?.length || 0) !== (command.options?.length || 0)
            ) {
              registrationNeeded = true;
              break;
            }
          }
        }

        if (registrationNeeded) {
          console.log(
            `[DISCORD] Registering ${commandData.length} commands...`
          );
          await client.application.commands.set(commandData);
          console.log("[DISCORD] Registering commands... SUCCESS!");
        } else {
          console.log(
            `[DISCORD] No command changes detected, skipping registration. Run "yarn run deploy" to force update commands if needed.`
          );
        }

        resolve({
          broadcastText,
          broadcastForm,
          cleanup: () => client.destroy(),
        });
      } catch (error) {
        console.error("Error registering application commands:", error);
        reject(error);
      }
    });

    client.on("interactionCreate", async (ctx) => {
      try {
        if (!ctx.isCommand()) return;
        if (!_.has(commands, ctx.commandName))
          return ctx.reply("the command does not exist");
        const command = commands[ctx.commandName];
        if (command.defer !== false) {
          await ctx.deferReply();
        }
        const wrapper = WrapperDiscord(ctx, client);
        await Promise.resolve(command.handler(wrapper));
      } catch (error) {
        if (error.code === 10062) {
          console.warn("Interaction expired:", error.message);
          return;
        }
        console.error("Discord interaction error:", error);
        try {
          await ctx.followUp({
            content: "An error occurred while processing your command.",
            ephemeral: true,
          });
        } catch (e) {
          console.error("Failed to send error message:", e);
        }
      }
    });
    const broadcast = (form) => {
      try {
        client.guilds.cache.forEach((guild) => {
          const chan = guild.channels.cache
            .filter(
              (channel) =>
                channel.permissionsFor(client.user).has("SEND_MESSAGES") &&
                channel.isText()
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
