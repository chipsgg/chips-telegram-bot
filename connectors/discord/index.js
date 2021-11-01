const assert = require("assert");
const _ = require("lodash");
const {
  Client,
  Intents,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
} = require("discord.js");

module.exports = (token, commands) => {
  assert(token, "requires token");
  assert(commands, "requires commands");
  return new Promise((resolve, reject) => {
    const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
    client.on("ready", async () => {
      console.log(`Logged in as ${client.user.tag}!`);
      _.forEach(_.keys(commands), (name) => {
        const command = commands[name];
        client.api
          .applications(client.user.id)
          .commands.post({
            data: {
              name,
              description: command.description,
            },
          })
          .catch(console.error);
      });
      resolve({
        broadcastText,
        broadcastForm,
      });
    });

    client.on("interactionCreate", async (ctx) => {
      if (!ctx.isCommand()) return;
      if (!_.has(commands, ctx.commandName))
        return ctx.reply("the command does not exist");
      await Promise.resolve(
        commands[ctx.commandName].handler({
          sendForm: (options) => {
            require(options, "requires options");
            context.reply(discordMakeForm(options));
          },
          sendText: (content) => {
            assert(content, "requires content");
            return context.reply({ content });
          },
        })
      );
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
    const broadcastText = (message) => {
      assert(message, "requires message");
      return broadcast({ content: message });
    };
    const broadcastForm = (options) => {
      assert(options, "requires options");
      return broadcast(discordMakeForm(options));
    };
    client.login(token);
  });
};

function discordMakeForm(options) {
  assert(options, "requires options");
  const { emoji, title, content, footer, banner, url, buttonLabel } = options;
  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setStyle("LINK")
      .setLabel(buttonLabel || "Click on link")
      .setURL(url || "https://chips.gg/")
  );
  const embed = new MessageEmbed()
    .setTitle(`${_.trim(emoji)} ${_.trim(title)} ${_.trim(emoji)}`)
    .setDescription(_.trim(content));
  if (footer)
    embed.setFooter(
      _.trim(footer),
      "https://cdn.chips.gg/public/images/assets/favicon/favicon-32x32.png"
    );
  if (banner) embed.setImage(banner);
  if (url) embed.setURL(url);
  return {
    content: " ",
    embeds: [embed],
    components: url && buttonLabel ? [row] : [],
  };
}
