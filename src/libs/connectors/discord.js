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

const WrapperDiscord = (context) => {
  console.log("WrapperDiscord", context);

  const sendForm = (...args) => context.reply(discordMakeForm(...args));
  const sendText = (content) => context.reply({ content });

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
    const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
    client.on("ready", async () => {
      console.log(`Logged in as ${client.user.tag}!`);
      try {
        const commandData = _.map(_.keys(commands), (name) => {
          const command = commands[name];
          const options = [];

          if (name === "user") {
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

        await client.application.commands.set(commandData);
        console.log("Successfully registered application commands");
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
      const wrapper = WrapperDiscord(ctx);

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
