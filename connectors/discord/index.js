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
  return { content: " ", embeds: [embed], components: (url && buttonLabel)?[row]:[] };
}

const WrapperDiscord = (context) => {
  const sendForm = (...args) => context.reply(discordMakeForm(...args));
  const sendText = (content) => context.reply({ content });
  return {
    sendForm,
    sendText,
  };
};

module.exports = (token, commands) => new Promise((resolve, reject)=> {
  const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
  client.on("ready", async() => {
    console.log(`Logged in as ${client.user.tag}!`);
    _.forEach(_.keys(commands), (name) => {
      const command = commands[name];
      client.api.applications(client.user.id).commands.post({data: {
        name,
        description: command.description
      }})
      .catch(console.error);
    });
    resolve({
      broadcastText,
      broadcastForm
    });
  });

  client.on("interactionCreate", async (ctx) => {
    if (!ctx.isCommand()) return;
    if (!_.has(commands, ctx.commandName)) return ctx.reply("the command does not exist")
    const wrapper = WrapperDiscord(ctx);
    await Promise.resolve(commands[ctx.commandName].handler(wrapper));
  });
  const broadcast = (form) => client.guilds.cache.forEach(guild => guild.channels.cache.get(guild.systemChannelId).send(form));
  const broadcastText = (message) => broadcast({ content: message });
  const broadcastForm = (...args) => broadcast(discordMakeForm(...args));
  client.login(token);
});