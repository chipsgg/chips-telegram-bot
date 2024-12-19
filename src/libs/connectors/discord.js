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
};

const WrapperDiscord = (context) => {
  const sendForm = (...args) => context.reply(discordMakeForm(...args));
  const sendText = (content) => context.reply({ content });
  return {
    sendForm,
    sendText,
  };
};

module.exports = (token, commands) =>
  new Promise((resolve, reject) => {
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
              options: name === 'user' ? [
                {
                  name: 'username',
                  description: 'Username to look up',
                  type: 3,
                  required: true
                }
              ] : undefined
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
      
      try {
        if (!_.has(commands, ctx.commandName)) {
          await ctx.reply("The command does not exist");
          return;
        }

        const wrapper = WrapperDiscord(ctx);
        let replied = false;

        wrapper.sendForm = async (...args) => {
          if (!replied) {
            replied = true;
            return ctx.reply(discordMakeForm(...args));
          }
          return ctx.followUp(discordMakeForm(...args));
        };

        wrapper.sendText = async (content) => {
          if (!replied) {
            replied = true;
            return ctx.reply({ content });
          }
          return ctx.followUp({ content });
        };
        
        if (ctx.commandName === 'user') {
          const username = ctx.options?.getString('username');
          wrapper.options = {
            getString: (param) => param === 'username' ? username : null
          };
        }
        
        await Promise.resolve(commands[ctx.commandName].handler(wrapper));
      } catch (error) {
        console.error('Command error:', error);
        try {
          await ctx.reply("An error occurred while processing the command");
        } catch (replyError) {
          console.error('Reply error:', replyError);
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
