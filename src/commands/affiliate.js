/**
 * Affiliate Stats Command (Backoffice)
 * Looks up affiliate campaign stats for any user by username.
 * Requires the invoking user to have the "backoffice" role.
 * Supports optional date range filtering (defaults to current month).
 * Aggregates campaign metrics and displays top referrals.
 */
const { ApplicationCommandOptionType } = require("discord.js");
const { formatUsd } = require("../libs/utils");

module.exports = (api) => ({
  name: "affiliate",
  description: "View affiliate stats for a user.",
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
    // Extract arguments based on platform
    let username, startDate, endDate;
    if (ctx.platform === "discord") {
      username = ctx.getString("username");
      startDate = ctx.getString("start");
      endDate = ctx.getString("end");
    } else {
      username = ctx.getArg(1);
      startDate = ctx.getArg(2);
      endDate = ctx.getArg(3);
    }

    if (!username) {
      return ctx.sendText("Please provide a username.");
    }

    // Default date range: start of current month to now
    const now = new Date();
    const start = startDate
      ? new Date(startDate).getTime()
      : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = endDate ? new Date(endDate).getTime() : now.getTime();

    // Validate parsed dates
    if (isNaN(start) || isNaN(end)) {
      return ctx.sendText(
        "Invalid date format. Please use YYYY-MM-DD (e.g. 2026-01-15).",
      );
    }

    const startLabel = new Date(start).toLocaleDateString();
    const endLabel = new Date(end).toLocaleDateString();

    try {
      // Authorize: look up the invoking user by platform ID
      const player = await api._actions.auth("getUserByPlatformID", {
        platform: ctx.platform,
        platformid: ctx.userid.toString(),
      });

      // Verify the invoking user has backoffice privileges
      if (!player.roles.includes("backoffice")) {
        return ctx.sendText("You are not authorized to use this command.");
      }

      // Fetch the target player's public profile
      const user = await api._actions.public("getPlayer", {
        userid: username,
      });

      // Retrieve affiliate campaigns for the target user within the date range
      const campaigns = await api._actions.backoffice("listCampaignsByUser", {
        sortKey: "wageredUsd",
        userid: user.id,
        start,
        end,
      });

      if (!Array.isArray(campaigns) || campaigns.length === 0) {
        return ctx.sendForm({
          emoji: "📊",
          title: "Affiliate Stats",
          content: `No affiliate campaigns found for **${username}** (${startLabel} — ${endLabel}).`,
          buttonLabel: "View Profile",
          url: `https://chips.gg/user/${username}`,
        });
      }

      // Aggregate stats across all campaigns
      let totalSignups = 0;
      let totalBets = 0;
      let totalWagered = 0;
      let totalCommission = 0;
      let totalDeposits = 0;
      let totalFTD = 0;
      let activeCampaigns = 0;

      campaigns.forEach((c) => {
        totalSignups += c.signups || 0;
        totalBets += c.stats?.bets || 0;
        totalWagered += c.stats?.wageredUsd || 0;
        totalCommission += c.stats?.commissionUsd || 0;
        totalDeposits += c.stats?.depositUsd || 0;
        totalFTD += c.stats?.ftd || 0;
        if (!c.done) activeCampaigns++;
      });

      // Build the response content with aggregated stats
      let content = `**Account:** ${user.username}\n`;
      content += `**Period:** ${startLabel} — ${endLabel}\n\n`;

      content += `📈 **Overall Stats**\n`;
      content += `Signups: ${totalSignups}\n`;
      content += `First Time Deposits: ${totalFTD}\n`;
      content += `Total Deposits: $${formatUsd(totalDeposits)}\n`;
      content += `Total Bets: ${formatUsd(totalBets)}\n`;
      content += `Total Wagered: $${formatUsd(totalWagered)}\n`;
      content += `Commission Earned: $${formatUsd(totalCommission)}\n`;

      // Fetch and append top 5 referrals sorted by wagered amount
      try {
        const referrals = await api._actions.backoffice("listReferralsByUser", {
          userid: user.id,
          sortKey: "wageredUsd",
          sortDirection: -1,
          start,
          end,
          skip: 0,
          limit: 5,
        });

        if (Array.isArray(referrals) && referrals.length > 0) {
          content += `\n🏆 **Top Referrals**\n`;
          referrals.forEach((r, i) => {
            content += `${i + 1}. **${r.user.username}** — $${formatUsd(r.depositUsd)} deposited, $${formatUsd(r.wageredUsd)} wagered\n`;
          });
        }
      } catch (refErr) {
        console.error("listReferralsByUser error:", refErr);
      }

      return ctx.sendForm({
        emoji: "📊",
        title: `Affiliate Stats: ${user.username}`,
        content,
        buttonLabel: "View Profile",
        url: `https://chips.gg/user/${username}`,
      });
    } catch (error) {
      console.error("/affiliate error:", error);
      return ctx.sendText(
        "Failed to fetch affiliate data. Please try again later.",
      );
    }
  },
});
