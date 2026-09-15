/**
 * Stats Command
 * Fetches and displays a player's public stats from the Chips.gg API.
 * Shows VIP rank/level, bet count, total wagered, bonuses, PnL,
 * and account join date. Supports optional date range filtering.
 */
const { ApplicationCommandOptionType } = require("discord.js");

module.exports = (api) => ({
  name: "stats",
  description: "Get user stats by username",
  options: {
    username: {
      description: "Chips.gg username",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    start: {
      description: "Start date (YYYY-MM-DD)",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    end: {
      description: "End date (YYYY-MM-DD)",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  },
  handler: async (ctx) => {
    let username, startDate, endDate;
    if (ctx.platform === "discord" || ctx.platform === "api") {
      username = ctx?.getString("username");
      startDate = ctx?.getString("start");
      endDate = ctx?.getString("end");
    } else {
      username = ctx?.getArg(1);
      startDate = ctx?.getArg(2);
      endDate = ctx?.getArg(3);
    }

    if (!username) {
      return ctx.sendText("Please provide a username");
    }

    const now = new Date();
    const start = startDate
      ? new Date(startDate).getTime()
      : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = endDate ? new Date(endDate).getTime() : now.getTime();

    if (isNaN(start) || isNaN(end)) {
      return ctx.sendText(
        "Invalid date format. Please use YYYY-MM-DD (e.g. 2026-01-15).",
      );
    }

    const startLabel = new Date(start).toLocaleDateString();
    const endLabel = new Date(end).toLocaleDateString();

    try {
      // Fetch player profile, VIP info, and stats from public API
      const { vip, stats, ...user } = await api._actions.public("getPlayer", {
        userid: username,
        start,
        end,
      });

      console.log("/stats", {
        user,
        vip,
        stats,
      });

      return ctx.sendForm({
        emoji: "👤",
        title: `Player: ${user.username}`,
        content: [
          `**Period:** ${startLabel} — ${endLabel}`,
          `**Rank:** ${vip.rank} (${vip.level || "0"})`,
          `**Bets:** ${stats.count.toLocaleString() || 0}`,
          `**Wagered:** $${(stats.wageredUsd || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          `**Bonuses:** $${(stats.bonusesUsd || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          `**PnL:** $${(stats.pnlUsd || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          `**Join Date:** ${new Date(user.created).toLocaleDateString()}`,
        ].join("\n"),
        url: `https://chips.gg/user/${user.username}`,
        buttonLabel: "View Profile",
      });
    } catch (e) {
      return ctx.sendText(`Error fetching user information: ${e.message}`);
    }
  },
});
