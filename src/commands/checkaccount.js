/**
 * Check Account Command
 * Checks if the invoking user has a linked Chips.gg account.
 * If linked, displays account details (username, user ID, platform, join date).
 * If not linked, prompts the user to use /linkaccount.
 */
module.exports = (api) => ({
  name: "checkaccount",
  description: "Check your linked Chips.gg account.",
  handler: async (ctx) => {
    // Ensure platform identity is available
    if (!ctx.platform || !ctx.userid) {
      return ctx.sendText("Could not identify your account. Please try again.");
    }

    try {
      // Look up the linked Chips.gg account by platform ID
      const player = await api._actions.auth("getUserByPlatformID", {
        platform: ctx.platform,
        platformid: ctx.userid.toString(),
      });

      // No linked account found
      if (!player) {
        return ctx.sendForm({
          emoji: "🔗",
          title: "No Linked Account",
          content:
            "You don't have a Chips.gg account linked yet.\nUse **/linkaccount** to connect your account.",
          buttonLabel: "Learn More",
          url: "https://chips.gg",
        });
      }

      // Build linked account details
      let content = `**Username:** ${player.username}\n`;
      content += `**User ID:** ${player.id}\n`;
      content += `**Platform:** ${ctx.platform}\n`;

      if (player?.created) {
        const joined = new Date(player.created).toLocaleDateString();
        content += `**Joined:** ${joined}\n`;
      }

      return ctx.sendForm({
        emoji: "✅",
        title: "Linked Account",
        content,
        buttonLabel: "View Profile",
        url: `https://chips.gg/user/${player.username}`,
      });
    } catch (error) {
      console.error("/checkaccount error:", error);

      // Treat "not found" errors as unlinked account
      if (
        error.message?.includes("not found") ||
        error.message?.includes("No user")
      ) {
        return ctx.sendForm({
          emoji: "🔗",
          title: "Account Link Error",
          content:
            "You don't have a Chips.gg account linked yet.\nUse **/linkaccount** to connect your account.",
          buttonLabel: "Learn More",
          url: "https://chips.gg",
        });
      }

      return ctx.sendText(
        "Failed to check linked account. Please try again later.",
      );
    }
  },
});
