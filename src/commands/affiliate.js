/**
 * Affiliate Stats Command (staff)
 * Affiliate campaign report for ANY user by username, for a date range
 * (defaults to the current UTC month). Caller must have a linked Chips.gg
 * account with admin/mod flags or the backoffice role.
 */
const { ApplicationCommandOptionType } = require("discord.js");
const { arg, dateRange } = require("../libs/utils");
const { linkedAccount, isStaff } = require("../libs/auth");
const affiliate = require("../libs/models/affiliate");

module.exports = (api) => ({
  name: "affiliate",
  description:
    "Staff: affiliate stats for any user. Usage: /affiliate username [start] [end]",
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
        "Please provide a username. Usage: /affiliate username [start] [end]"
      );
    }

    const period = dateRange(arg(ctx, "start", 2), arg(ctx, "end", 3));
    if (period.error) return ctx.sendText(period.error);

    try {
      const caller = await linkedAccount(api, ctx);
      if (!caller) {
        return ctx.sendText(
          "Link your Chips.gg account first with /linkaccount, then try again."
        );
      }
      if (!(await isStaff(api, caller))) {
        return ctx.sendText("You are not authorized to use this command.");
      }

      const user = await api._actions.public("getPlayer", { userid: username });
      if (!user?.id) return ctx.sendText(`User "${username}" not found.`);

      const { campaigns, referrals } = await affiliate.fetch(
        api,
        user.id,
        period
      );
      if (campaigns.length === 0) {
        return ctx.sendForm({
          emoji: "📊",
          title: `Affiliate Stats: ${user.username}`,
          content: `No affiliate campaigns found for **${user.username}** (${period.startLabel} — ${period.endLabel}).`,
          buttonLabel: "View Profile",
          url: `https://chips.gg/user/${user.username}`,
        });
      }

      return ctx.sendForm({
        emoji: "📊",
        title: `Affiliate Stats: ${user.username}`,
        content: affiliate.render({
          user,
          period,
          totals: affiliate.aggregate(campaigns),
          referrals,
          staff: true,
        }),
        buttonLabel: "View Profile",
        url: `https://chips.gg/user/${user.username}`,
      });
    } catch (error) {
      console.error("[affiliate] failed:", error.message);
      return ctx.sendText(
        "Failed to fetch affiliate data. Please try again later."
      );
    }
  },
});
