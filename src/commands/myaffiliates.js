/**
 * My Affiliates Command
 * Affiliate report for the caller's own linked Chips.gg account, for a date
 * range (defaults to the current UTC month). Player-facing: no cost lines.
 */
const { ApplicationCommandOptionType } = require("discord.js");
const { arg, dateRange } = require("../libs/utils");
const { linkedAccount } = require("../libs/auth");
const affiliate = require("../libs/models/affiliate");

module.exports = (api) => ({
  name: "myaffiliates",
  description:
    "Your own affiliate campaign stats. Usage: /myaffiliates [start] [end]",
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
    if (ctx.platform === "api") {
      return ctx.sendText(
        "This command needs a linked Discord or Telegram account."
      );
    }

    const period = dateRange(arg(ctx, "start", 1), arg(ctx, "end", 2));
    if (period.error) return ctx.sendText(period.error);

    try {
      const user = await linkedAccount(api, ctx);
      if (!user) {
        return ctx.sendForm({
          emoji: "🔗",
          title: "No Linked Account",
          content:
            "Link your Chips.gg account first with **/linkaccount**, then run /myaffiliates again.",
          buttonLabel: "Affiliate Program",
          url: "https://chips.gg/affiliates",
        });
      }

      const { campaigns, referrals } = await affiliate.fetch(
        api,
        user.id,
        period
      );
      if (campaigns.length === 0) {
        return ctx.sendForm({
          emoji: "📊",
          title: "Affiliate Dashboard",
          content: `No affiliate campaigns found for ${period.startLabel} — ${period.endLabel}.`,
          buttonLabel: "Create Campaign",
          url: "https://chips.gg/affiliates/affiliates-campaigns",
        });
      }

      return ctx.sendForm({
        emoji: "📊",
        title: "Affiliate Dashboard",
        content: affiliate.render({
          user,
          period,
          totals: affiliate.aggregate(campaigns),
          referrals,
          staff: false,
        }),
        buttonLabel: "View Full Dashboard",
        url: "https://chips.gg/affiliates",
        ephemeral: true,
      });
    } catch (error) {
      console.error("[myaffiliates] failed:", error.message);
      return ctx.sendText(
        "Failed to fetch affiliate data. Please try again later."
      );
    }
  },
});
