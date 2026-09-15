/**
 * Affiliate report model
 * Shared by /affiliate (staff lookup of any user) and /myaffiliates (own linked account).
 * Aggregation follows the ledger rules: sum campaign-row `stats` only (never referral
 * rows on top), `signups` from the campaign row, Code Profit = -profitUsd.
 */
const _ = require("lodash");
const { formatUsd, formatInt } = require("../../utils");

const sumStat = (campaigns, key) =>
  _.sumBy(campaigns, (c) => Number(c.stats?.[key]) || 0);

// Fold campaign rows into one totals object
exports.aggregate = (campaigns) => ({
  campaigns: campaigns.length,
  active: campaigns.filter((c) => !c.done).length,
  signups: _.sumBy(campaigns, (c) => Number(c.signups) || 0),
  ftd: sumStat(campaigns, "ftd"),
  bets: sumStat(campaigns, "bets"),
  depositUsd: sumStat(campaigns, "depositUsd"),
  wageredUsd: sumStat(campaigns, "wageredUsd"),
  commissionUsd: sumStat(campaigns, "commissionUsd"),
  bonusUsd: sumStat(campaigns, "bonusUsd"),
  // Chips convention: negative profitUsd = house profit, so flip for "code profit"
  codeProfitUsd: -sumStat(campaigns, "profitUsd"),
});

// Build the form body. `opts.staff` adds the cost lines a player should not see.
exports.render = ({ user, period, totals, referrals = [], staff = false }) => {
  const lines = [
    `**Account:** ${user.username}`,
    `**Period:** ${period.startLabel} — ${period.endLabel}`,
    `**Campaigns:** ${totals.active} active / ${totals.campaigns} total`,
    "",
    "📈 **Referred activity**",
    `Signups: ${formatInt(totals.signups)}`,
    `First-time deposits: ${formatInt(totals.ftd)}`,
    `Deposits: $${formatUsd(totals.depositUsd)}`,
    `Bets: ${formatInt(totals.bets)}`,
    `Wagered: $${formatUsd(totals.wageredUsd)}`,
    "",
    "💸 **Earnings**",
    `Commission: $${formatUsd(totals.commissionUsd)}`,
  ];

  if (staff) {
    lines.push(
      `Bonuses handed to referrals: $${formatUsd(totals.bonusUsd)}`,
      `Code profit (house): $${formatUsd(totals.codeProfitUsd)}`
    );
  }

  if (referrals.length) {
    lines.push("", "🏆 **Top referrals (by wager)**");
    referrals.forEach((r, i) => {
      const name = r.user?.username || String(r._id || "").slice(0, 8);
      lines.push(
        `${i + 1}. **${name}** — $${formatUsd(r.wageredUsd)} wagered, $${formatUsd(r.depositUsd)} deposited`
      );
    });
  }

  return lines.join("\n");
};

// Fetch campaigns + top referrals for a userid in a window (read-only backoffice calls)
exports.fetch = async (api, userid, { start, end }, topN = 5) => {
  const campaigns = await api._actions.backoffice("listCampaignsByUser", {
    userid,
    start,
    end,
  });
  const rows = Array.isArray(campaigns) ? campaigns : [];
  if (rows.length === 0) return { campaigns: rows, referrals: [] };

  let referrals = [];
  try {
    const refs = await api._actions.backoffice("listReferralsByUser", {
      userid,
      sortKey: "wageredUsd",
      sortDirection: -1,
      start,
      end,
      skip: 0,
      limit: topN,
    });
    referrals = Array.isArray(refs) ? refs : [];
  } catch (err) {
    console.error("[affiliate] listReferralsByUser failed:", err.message);
  }
  return { campaigns: rows, referrals };
};
