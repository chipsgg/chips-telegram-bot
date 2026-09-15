/**
 * Check Account Command
 * Shows the Chips.gg account linked to the caller's Discord/Telegram identity,
 * or explains how to link one.
 */
const { linkedAccount } = require("../libs/auth");

const notLinked = () => ({
  emoji: "🔗",
  title: "No Linked Account",
  content:
    "You don't have a Chips.gg account linked yet.\nUse **/linkaccount** to connect your account.",
  buttonLabel: "Chips.gg",
  url: "https://chips.gg",
});

module.exports = (api) => ({
  name: "checkaccount",
  description: "Check your linked Chips.gg account.",
  handler: async (ctx) => {
    if (ctx.platform === "api") {
      return ctx.sendText("This command needs a Discord or Telegram identity.");
    }

    try {
      const player = await linkedAccount(api, ctx);
      if (!player) return ctx.sendForm(notLinked());

      const lines = [
        `**Username:** ${player.username}`,
        `**Platform:** ${ctx.platform}`,
      ];
      if (player.nickname && player.nickname !== player.username) {
        lines.push(`**Nickname:** ${player.nickname}`);
      }

      return ctx.sendForm({
        emoji: "✅",
        title: "Linked Account",
        content: lines.join("\n"),
        buttonLabel: "View Profile",
        url: `https://chips.gg/user/${player.username}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("[checkaccount] failed:", error.message);
      return ctx.sendText(
        "Failed to check linked account. Please try again later."
      );
    }
  },
});
