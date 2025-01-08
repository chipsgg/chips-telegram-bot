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
      .setURL(url || "https://chips.gg/"),
  );
  const embed = new EmbedBuilder()
    .setTitle(`${_.trim(emoji)} ${_.trim(title)} ${_.trim(emoji)}`)
    .setDescription(_.trim(content));
  if (footer)
    embed.setFooter(
      _.trim(footer),
      "https://cdn.chips.gg/public/images/assets/favicon/favicon-32x32.png",
    );
  if (banner) {
    try {
      embed.setImage(banner);
    } catch (error) {
      console.error('Failed to set image:', error);
    }
  }
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
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
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
          } else if (name === "promotion") {
            options.push({
              name: "promotionid",
              description: "Promotion ID to look up",
              type: 3,
              required: true,
            });
          } else if (name === "bet") {
            options.push({
              name: "betid",
              description: "Bet ID to look up",
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
          } else if (name === "compare") {
            options.push(
              {
                name: "username1",
                description: "First username to compare",
                type: 3,
                required: true,
              },
              {
                name: "username2",
                description: "Second username to compare",
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

        console.log("Registering commands...");
        for (const command of commandData) {
          await client.application.commands.create(command);
        }
        console.log("Registering commands... SUCCESS!");

        // await client.application.commands.set(commandData);

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
        await ctx.deferReply();
        const wrapper = WrapperDiscord(ctx, client);
        await Promise.resolve(commands[ctx.commandName].handler(wrapper));
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
