/**
 * Stats Command
 * A player's public stats: VIP rank/level, bets, wagered, bonuses, PnL, join date.
 *
 * Window: `public/getUserStats` honours `start`/`end` (ms) or a `duration` enum;
 * `public/getPlayer` does NOT (its embedded stats are always trailing 30 days),
 * so profile and stats are fetched separately.
 */
const { ApplicationCommandOptionType } = require("discord.js");
const { arg, dateRange, formatUsd, formatInt } = require("../libs/utils");

module.exports = (api) => ({
  name: "stats",
  description: "Player stats by username. Usage: /stats username [start] [end]",
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
    const username = arg(ctx, "username", 1);
    if (!username) {
      return ctx.sendText(
        "Please provide a username. Usage: /stats username [start] [end]"
      );
    }

    const startArg = arg(ctx, "start", 2);
    const endArg = arg(ctx, "end", 3);
    const explicit = Boolean(startArg || endArg);
    const period = dateRange(startArg, endArg);
    if (period.error) return ctx.sendText(period.error);

    try {
      const player = await api._actions.public("getPlayer", {
        userid: username,
      });
      if (!player?.id) return ctx.sendText(`User "${username}" not found.`);

      // Explicit dates -> exact window; otherwise trailing 30 days (server enum)
      const stats = await api._actions.public(
        "getUserStats",
        explicit
          ? { userid: player.id, start: period.start, end: period.end }
          : { userid: player.id, duration: "1m" }
      );
      const periodLabel = explicit
        ? `${period.startLabel} — ${period.endLabel}`
        : "last 30 days";

      const vip = player.vip || {};
      const s = stats || {};
      // Player-side PnL: positive = player is up over the window.
      const pnl = Number(s.pnlUsd || 0);

      return ctx.sendForm({
        emoji: "👤",
        title: `Player: ${player.username}`,
        content: [
          `**Period:** ${periodLabel}`,
          `**Rank:** ${vip.rank || "Unranked"}${vip.level ? ` (level ${vip.level})` : ""}`,
          `**Bets:** ${formatInt(s.count)}`,
          `**Wagered:** $${formatUsd(s.wageredUsd)}`,
          `**Bonuses:** $${formatUsd(s.bonusesUsd)}`,
          `**PnL:** ${pnl < 0 ? "-" : ""}$${formatUsd(Math.abs(pnl))}`,
          `**Joined:** ${
            player.created
              ? new Date(player.created).toISOString().slice(0, 10)
              : "unknown"
          }`,
        ].join("\n"),
        url: `https://chips.gg/user/${player.username}`,
        buttonLabel: "View Profile",
      });
    } catch (e) {
      console.error("[stats] failed:", e.message);
      return ctx.sendText(
        `Could not fetch stats for "${username}": ${e.message}`
      );
    }
  },
});
