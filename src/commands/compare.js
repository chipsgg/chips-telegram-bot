const {
  ApplicationCommandOptionType,
  MessageFlags,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = () => ({
  name: "compare",
  description: "Compare two users' stats. Usage: /compare username1 username2",
  options: {
    username1: {
      description: "First Chips.gg username",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    username2: {
      description: "Second Chips.gg username",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  },
  handler: async (ctx) => {
    let username1, username2;
    if (ctx.platform !== "discord") {
      username1 = ctx?.getArg(1);
      username2 = ctx?.getArg(2);
      if (!username1 || !username2) {
        return ctx.sendText("Please provide both usernames to compare");
      }

      return ctx.sendForm({
        emoji: "🔄",
        title: `Comparing ${username1} vs ${username2}`,
        banner: `https://stats.chips.gg/compare/${username1}/${username2}`,
        buttonLabel: "View Profiles",
        url: `https://chips.gg/user/${username1}`,
      });
    }

    username1 = ctx?.getString("username1");
    username2 = ctx?.getString("username2");
    if (!username1 || !username2) {
      return ctx.sendText("Please provide both usernames to compare");
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(`View ${username1.slice(0, 19)}`)
        .setURL("https://chips.gg/user/" + username1),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(`View ${username2.slice(0, 19)}`)
        .setURL("https://chips.gg/user/" + username2)
    );

    const image = await fetch(
      `https://stats.chips.gg/compare/${username1}/${username2}`
    );
    if (!image.ok || !image.headers.get("content-type").startsWith("image/")) {
      await ctx.interaction.deleteReply();
      await ctx.interaction.followUp({
        content: `Failed to fetch comparison image! Please try again later.`,
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const buffer = await image.arrayBuffer();
    await ctx.interaction.editReply({
      files: [
        new AttachmentBuilder(Buffer.from(buffer), {
          name: "comparison.png",
        }),
      ],
      components: [row],
    });
  },
});
