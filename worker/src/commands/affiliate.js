/**
 * Affiliate report model — shared by /affiliate (staff) and /myaffiliates (self).
 * Sums campaign rows only (never referral rows on top). Code profit = -profitUsd
 * (Chips convention: negative profitUsd = house profit).
 */
import { formatInt, formatUsd } from "../lib/format.js";

const sumStat = (rows, key) =>
  rows.reduce((acc, c) => acc + (Number(c.stats?.[key]) || 0), 0);

export const aggregate = (campaigns) => ({
  campaigns: campaigns.length,
  active: campaigns.filter((c) => !c.done).length,
  signups: campaigns.reduce((acc, c) => acc + (Number(c.signups) || 0), 0),
  ftd: sumStat(campaigns, "ftd"),
  bets: sumStat(campaigns, "bets"),
  depositUsd: sumStat(campaigns, "depositUsd"),
  wageredUsd: sumStat(campaigns, "wageredUsd"),
  commissionUsd: sumStat(campaigns, "commissionUsd"),
  bonusUsd: sumStat(campaigns, "bonusUsd"),
  codeProfitUsd: -sumStat(campaigns, "profitUsd"),
});

export const render = ({
  user,
  period,
  totals,
  referrals = [],
  staff = false,
}) => {
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

export const fetch = async (api, userid, { start, end }, topN = 5) => {
  const campaigns = await api.backoffice("listCampaignsByUser", {
    userid,
    start,
    end,
  });
  const rows = Array.isArray(campaigns) ? campaigns : [];
  if (rows.length === 0) return { campaigns: rows, referrals: [] };
  let referrals = [];
  try {
    const refs = await api.backoffice("listReferralsByUser", {
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
