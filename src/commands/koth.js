/**
 * King of the Hill (KOTH) Command
 * Displays the current King of the Hill game status banner.
 * On Discord, the banner is uploaded as a file attachment.
 * On other platforms, the banner URL is sent directly.
 */
const { AttachmentBuilder } = require("discord.js");

module.exports = () => ({
  name: "koth",
  description: "Display current King of the Hill information",
  handler: async (ctx) => {
    // const koth = api.get('public', 'koth');

    // Non-Discord: send banner URL directly
    if (ctx.platform !== "discord") {
      return ctx.sendForm({
        emoji: "👑",
        title: "KING OF THE HILL",
        banner: "https://stats.chips.gg/koth",
        buttonLabel: "BE KING.",
        url: "https://chips.gg/koth",
      });
    }

    // Discord: attach the KOTH banner image as a file
    return ctx.sendForm({
      emoji: "👑",
      title: "KING OF THE HILL",
      banner: `attachment://koth.png`,
      buttonLabel: "BE KING.",
      url: "https://chips.gg/koth",
      files: [
        new AttachmentBuilder("https://stats.chips.gg/koth", {
          name: "koth.png",
        }),
      ],
    });
  },
});
