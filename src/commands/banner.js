/**
 * Banner Command
 * Displays a visual stats banner image for a Chips.gg user.
 * The banner is fetched from stats.chips.gg.
 * On Discord, the image is uploaded as an attachment with a profile link button.
 * On other platforms, the banner URL is sent directly via sendForm.
 */
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ApplicationCommandOptionType,
} = require("discord.js");

module.exports = () => ({
  name: "banner",
  description: "Show user stats banner. Usage: /banner username",
  options: {
    username: {
      description: "Chips.gg username",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  },
  handler: async (ctx) => {
    let username = null;

    // Non-Discord platforms: send banner URL directly
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

    // Discord: upload the banner image as a file attachment
    username = ctx?.getString("username");
    if (!username) {
      return ctx.sendText("Please provide a username");
    }

    // Build a "View Profile" link button
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(`View ${username.slice(0, 19)}`)
        .setURL("https://chips.gg/user/" + username)
    );

    // Reply with the banner image as an attachment
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
