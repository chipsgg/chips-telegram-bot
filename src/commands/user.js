const { ApplicationCommandOptionType } = require("discord.js");

module.exports = (api) => ({
  name: "user",
  description: "Get user information by username",
  options: {
    username: {
      description: "Chips.gg username",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  },
  handler: async (ctx) => {
    let username = null;
    if (ctx.platform === "discord") {
      username = ctx?.getString("username");
    } else {
      username = ctx?.getArg(1);
    }

    if (!username) {
      return ctx.sendText("Please provide a username");
    }

    try {
      const user = await api._actions.public("getUser", { userid: username });
      if (!user) {
        return ctx.sendText("User not found");
      }

      const [vip, stats] = await Promise.all([
        api._actions.public("getUserVipRank", {
          userid: user.id,
        }),
        api._actions.public("getUserStats", {
          userid: user.id,
          duration: "1m",
        }),
      ]);

      console.log("/user", {
        user,
        vip,
        stats,
      });

      return ctx.sendForm({
        emoji: "👤",
        title: `User Info: ${user.username}`,
        content: [
          `Username: ${user.username}`,
          `Level: ${vip.rank} (${vip.level || "0"})`,
          `Total Bets: ${stats.count.toLocaleString() || 0}`,
          `Total Wins: ${stats.wins.toLocaleString() || 0}`,
          `Total Wagered: $${(stats.wageredUsd || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          `Total Bonuses: $${(stats.bonusesUsd || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          `Join Date: ${new Date(user.created).toLocaleDateString()}`,
        ].join("\n"),
        url: `https://chips.gg/user/${user.username}`,
        buttonLabel: "View Profile",
      });
    } catch {
      return ctx.sendText("Error fetching user information");
    }
  },
});
