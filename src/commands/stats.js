const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ApplicationCommandOptionType,
} = require("discord.js");

module.exports = () => ({
  name: "stats",
  description: "Show user stats banner. Usage: /stats username",
  options: {
    username: {
      description: "Chips.gg username",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  },
  handler: async (ctx) => {
    let username = null;
    if (ctx.platform !== "discord") {
      username = ctx?.getArg(1);
      if (!username) {
        return ctx.sendText("Please provide a username");
      }
      return ctx.sendForm({
        emoji: "📊",
        title: `Stats Banner: ${username}`,
        // content: "Here are your stats:",
        banner: `https://stats.chips.gg/stats/${username}`,
        buttonLabel: "View Profile",
        url: `https://chips.gg/user/${username}`,
      });
    }

    username = ctx?.getString("username");
    if (!username) {
      return ctx.sendText("Please provide a username");
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(`View ${username.slice(0, 19)}`)
        .setURL("https://chips.gg/user/" + username)
    );

    await ctx.interaction.editReply({
      files: [
        new AttachmentBuilder("https://stats.chips.gg/stats/" + username, {
          name: `${username}.png`,
        }),
      ],
      components: [row],
    });
  },
});
