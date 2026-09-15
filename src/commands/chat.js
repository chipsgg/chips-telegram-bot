/**
 * Chat Command
 * Returns invite links to the official Chips.gg community channels
 * on Discord and Telegram.
 */
module.exports = () => ({
  name: "chat",
  description: "Get invite links to official Telegram/Discord communities",
  handler: (ctx) =>
    ctx.sendForm({
      emoji: "💬",
      title: "Official Communities",
      content: [
        "Join our communities to chat with other players!",
        "",
        "Discord: https://discord.gg/chips",
        "Telegram: https://t.me/chipsgg",
      ].join("\n"),
      buttonLabel: "Join Discord",
      url: "https://discord.gg/chips",
    }),
});
