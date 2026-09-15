/**
 * My Affiliates Command
 * Personal affiliate dashboard that uses the invoking user's linked account.
 * Displays campaign stats (signups, deposits, wagered, commission) and
 * top referrals within an optional date range (defaults to current month).
 */
const { ApplicationCommandOptionType } = require("discord.js");
const { formatUsd } = require("../libs/utils");

module.exports = (api) => ({
  name: "myaffiliates",
  description: "View your own affiliate campaign stats.",
  options: {
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
    // Ensure the user's platform identity is available
    if (!ctx.platform || !ctx.userid) {
      return ctx.sendText("Could not identify your account. Please try again.");
    }

    // Extract optional date range arguments
    let startDate, endDate;
    if (ctx.platform === "discord") {
      startDate = ctx.getString("start");
      endDate = ctx.getString("end");
    } else {
      startDate = ctx.getArg(1);
      endDate = ctx.getArg(2);
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
      // Look up the invoking user's linked Chips.gg account
      const user = await api.getUserByPlatformID(
        ctx.platform,
        ctx.userid.toString(),
      );

      // Fetch affiliate campaigns for the linked user
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
          content: `No affiliate campaigns found for ${startLabel} — ${endLabel}.`,
          buttonLabel: "Create Campaign",
          url: "https://chips.gg/affiliates/affiliates-campaigns",
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
        title: "Affiliate Dashboard",
        content,
        buttonLabel: "View Full Dashboard",
        url: "https://chips.gg/affiliate",
      });
    } catch (error) {
      console.error("/affiliate error:", error);
      return ctx.sendText(
        "Failed to fetch affiliate data. Please try again later.",
      );
    }
  },
});
