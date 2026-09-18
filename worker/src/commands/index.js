/**
 * Command registry. Each command:
 *   { name, description, options?: {name:{description,type,required}}, staffOnly?, identity?, handler(ctx, deps) }
 * ctx (platform-normalised): { platform, userid, isPrivate, getString(name, index), sendForm(form), sendText(text) }
 * deps: { api (chips RPC), feed (DO accessor), env }
 * Forms: { emoji, title, content, url?, buttonLabel?, banner?, ephemeral? }
 *
 * Discord option types: 3 = STRING, 10 = NUMBER (kept numeric for the register script).
 */
import {
  arg,
  dateRange,
  formatDate,
  formatInt,
  formatNumber,
  formatPrice,
  formatSignedUsd,
  formatUsd,
  timeUntil,
  toUsd,
} from "../lib/format.js";
import {
  assignDiscordRole,
  discordRoleForRank,
} from "../platform/discord-rest.js";
import * as affiliate from "./affiliate.js";
import { isStaff, linkedAccount } from "./identity.js";

const STRING = 3;
const S = (description, required = false) => ({
  description,
  type: STRING,
  required,
});

const usernameOpt = S("Chips.gg username", true);
const startOpt = S("Start date (YYYY-MM-DD)");
const endOpt = S("End date (YYYY-MM-DD)");

// ---------------------------------------------------------------------------

const help = {
  name: "help",
  description: "Description of all commands",
  handler: (ctx) =>
    ctx.sendForm({
      emoji: "ℹ️",
      title: "Helper",
      content: Object.values(commands)
        .filter((c) => !c.staffOnly)
        .map((c) => `/${c.name} - ${c.description}`)
        .join("\n"),
    }),
};

const chat = {
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
};

const prices = {
  name: "prices",
  description: "Crypto prices in USD. Usage: /prices [currency]",
  options: { currency: S("Currency to filter by") },
  handler: async (ctx, { feed }) => {
    const filter = arg(ctx, "currency", 1)?.toLowerCase();
    const { data, stale } = await feed.get("public.currencies");
    const all = Object.values(data["public.currencies"] || {}).filter(
      (c) =>
        c &&
        !c.hidden &&
        c.name !== "chips" &&
        c.name !== "chips_staking" &&
        !c.name.startsWith("usd") &&
        !c.name.endsWith("usd")
    );
    if (all.length === 0)
      return ctx.sendText("Prices are warming up, try again in a few seconds.");
    const list = filter
      ? all.filter((c) => c.name.toLowerCase() === filter)
      : all;
    if (list.length === 0)
      return ctx.sendText(
        "Currency not found. Use /prices to see all available currencies."
      );
    return ctx.sendForm({
      emoji: "📈",
      title: "Market prices",
      content: list
        .sort((a, b) => b.price - a.price)
        .map((c) => `${c.name.toUpperCase()}/USD: ${formatPrice(c.price)}`)
        .join("\n"),
      footer: stale ? "prices may be delayed" : undefined,
    });
  },
};

// Shared leaderboard shaping for /bigwins + /luckiest
const topBets = (rows, currencies, orderBy) =>
  Object.values(rows || {})
    .filter((r) => r?.bet && Object.keys(r.bet).length > 0 && r.player)
    .map((r) => {
      const cur = currencies?.[r.bet.currency];
      return {
        ...r,
        amountUsd: toUsd(r.bet.amount, cur),
        winningsUsd: toUsd(r.bet.winnings, cur),
      };
    })
    .sort((a, b) => orderBy(b) - orderBy(a))
    .filter((r, i, arr) => arr.findIndex((x) => x.userid === r.userid) === i)
    .slice(0, 10);

const leaderboardLines = (rows, ctx) =>
  rows
    .map((r, i) => {
      const line = `${i + 1}. ${formatPrice(r.amountUsd)} ➜ **${formatPrice(r.winningsUsd)}** (${formatNumber(r.bet.multiplier)}x)`;
      const who = `${r.player.username} in ${r.game?.title || r.bet.slotname || "a game"}`;
      return ctx.platform === "discord"
        ? `${line}\n-# Won by [${r.player.username}](https://chips.gg/user/${r.player.username}) in [${r.game?.title || r.bet.slotname}](https://chips.gg/play/${r.game?.slug || r.bet.gamecode})`
        : `${line}\n    ${who}`;
    })
    .join("\n");

const bigwins = {
  name: "bigwins",
  description: "Ranking of players with big wins",
  handler: async (ctx, { feed }) => {
    const { data } = await feed.get("stats.bets.bigwins", "public.currencies");
    const top = topBets(
      data["stats.bets.bigwins"],
      data["public.currencies"],
      (r) => r.winningsUsd
    );
    if (top.length === 0)
      return ctx.sendText(
        "Leaderboard is warming up, try again in a few seconds."
      );
    return ctx.sendForm({
      emoji: "🎰",
      title: "Big Wins",
      content: leaderboardLines(top, ctx),
      url: "https://chips.gg/casino",
      buttonLabel: "Play Now",
    });
  },
};

const luckiest = {
  name: "luckiest",
  description: "Ranking of the luckiest players",
  handler: async (ctx, { feed }) => {
    const { data } = await feed.get("stats.bets.luckiest", "public.currencies");
    const top = topBets(
      data["stats.bets.luckiest"],
      data["public.currencies"],
      (r) => Number(r.bet.multiplier) || 0
    );
    if (top.length === 0)
      return ctx.sendText(
        "Leaderboard is warming up, try again in a few seconds."
      );
    return ctx.sendForm({
      emoji: "🍀",
      title: "Luckiest Wins",
      content: leaderboardLines(top, ctx),
      url: "https://chips.gg/casino",
      buttonLabel: "Play Now",
    });
  },
};

const mostplayed = {
  name: "mostplayed",
  description: "List most played games",
  handler: async (ctx, { api }) => {
    const games = await api.public("listGamesMostPlayed", {
      skip: 0,
      limit: 10,
      duration: "1m",
    });
    const content = (games || [])
      .map((g, i) =>
        ctx.platform === "api"
          ? `${i + 1}. ${g.title} (${g.provider})`
          : `${i + 1}. **[${g.title}](https://chips.gg/play/${g.slug})** by [${g.provider}](https://chips.gg/casino/providers/${g.provider})`
      )
      .join("\n");
    return ctx.sendForm({
      emoji: "🎮",
      title: "Most Played Games",
      content,
      url: "https://chips.gg/casino",
      buttonLabel: "Play Now",
    });
  },
};

const slotcall = {
  name: "slotcall",
  description: "Get a random slot",
  handler: async (ctx, { api }) => {
    const slots = await api.public("listGamesMostPlayed", {
      skip: 0,
      limit: 100,
    });
    const pool = (slots || []).filter(
      (x) => Array.isArray(x.tags) && x.tags.includes("slots")
    );
    const slot = (pool.length ? pool : slots)[
      Math.floor(Math.random() * (pool.length ? pool : slots).length)
    ];
    if (!slot) return ctx.sendText("No slots available right now.");
    return ctx.sendForm({
      emoji: "🎰",
      title: "Chips Casino Slot Call",
      content: `🎩 ${slot.title}\n🎩 ${slot.producer}\n🎩 RTP ${formatNumber(slot.rtp)}%`,
      footer:
        "Good Luck and may the Chips be forever stacked in your favour ⭐️",
      banner: slot.images?.s2 || slot.images?.bg,
      url: `https://chips.gg/play/${slot.slug || slot.id}`,
      buttonLabel: "🎰 PLAY NOW 🎰",
      reroll: "slotcall",
    });
  },
};

const search = {
  name: "search",
  description: "Search the game catalog. Usage: /search game_name",
  options: { query: S("Search query", true) },
  handler: async (ctx, { api }) => {
    const query =
      ctx.platform === "telegram" ? ctx.rest(1) : arg(ctx, "query", 1);
    if (!query)
      return ctx.sendText(
        "Please provide a search query. Usage: /search game_name"
      );
    const games = await api.public("searchGames", {
      skip: 0,
      limit: 5,
      term: query,
    });
    if (!games || games.length === 0) {
      return ctx.sendForm({
        emoji: "🎮",
        title: "Game Search",
        content: "No games found matching your search.",
        url: "https://chips.gg/casino",
        buttonLabel: "Browse Games",
      });
    }
    const list = games
      .map(
        (g, i) =>
          `${i + 1}. **[${g.title}](https://chips.gg/play/${g.slug || g.id})** — ${g.provider}`
      )
      .join("\n");
    return ctx.sendForm({
      emoji: "🎮",
      title: "Game Search Results",
      content: `Found ${games.length} games matching "${query}":\n\n${list}`,
      url: "https://chips.gg/casino",
      buttonLabel: "Play Now",
    });
  },
};

const promotions = {
  name: "promotions",
  description: "Ongoing promotions and events",
  handler: async (ctx, { api }) => {
    const running = await api.public("listRunningPromotions", {});
    const list = Array.isArray(running) ? running : [];
    const summarize = (p) => {
      const sub = (p.subtitle || "").trim();
      if (sub) return sub;
      const line = String(p.description || "")
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("#"));
      if (!line) return "";
      const clean = line.replace(/[*_`#>]/g, "").trim();
      return clean.length > 140 ? `${clean.slice(0, 137)}...` : clean;
    };
    return ctx.sendForm({
      emoji: "✨",
      title: "ONGOING EVENTS",
      content:
        list.length === 0
          ? "**There are no active events at the moment!** 😴"
          : list
              .sort((a, b) => a.endTime - b.endTime)
              .map((p) => {
                const s = summarize(p);
                return [
                  `🎮 **[${(p.title || "").trim()}](https://chips.gg/promotions/${p.promotionid})**`,
                  `⏰ Ends ${timeUntil(p.endTime)} (${formatDate(p.endTime)})`,
                  s ? `📝 ${s}` : null,
                ]
                  .filter(Boolean)
                  .join("\n");
              })
              .join("\n\n"),
      url: "https://chips.gg/promotions",
      buttonLabel: "✨ VIEW EVENTS ✨",
    });
  },
};

const promotion = {
  name: "promotion",
  description: "Show promotion banner. Usage: /promotion promotionid",
  options: { promotionid: S("Promotion ID", true) },
  handler: async (ctx, { api }) => {
    const id = arg(ctx, "promotionid", 1);
    if (!id)
      return ctx.sendText(
        "Please provide a promotion ID. Usage: /promotion promotionid"
      );
    try {
      const promo = await api.public("getPromotion", { gameid: id });
      return ctx.sendForm({
        emoji: "🎉",
        title: promo.title,
        banner: `https://stats.chips.gg/promotions/${id}`,
        buttonLabel: "View Promotion",
        url: `https://chips.gg/promotions/${id}`,
      });
    } catch (e) {
      return ctx.sendText(`Promotion not found: ${e.message}`);
    }
  },
};

const koth = {
  name: "koth",
  description: "Display current King of the Hill information",
  handler: (ctx) =>
    ctx.sendForm({
      emoji: "👑",
      title: "KING OF THE HILL",
      banner: "https://stats.chips.gg/koth",
      buttonLabel: "BE KING.",
      url: "https://chips.gg/koth",
    }),
};

const bet = {
  name: "bet",
  description: "Show bet card. Usage: /bet betid",
  options: { betid: S("Bet ID", true) },
  handler: (ctx) => {
    const id = arg(ctx, "betid", 1);
    if (!id) return ctx.sendText("Please provide a bet ID. Usage: /bet betid");
    return ctx.sendForm({
      emoji: "🎲",
      title: `Bet: ${id}`,
      banner: `https://stats.chips.gg/bets/${encodeURIComponent(id)}`,
    });
  },
};

const banner = {
  name: "banner",
  description: "Show user stats banner. Usage: /banner username",
  options: { username: usernameOpt },
  handler: (ctx) => {
    const u = arg(ctx, "username", 1);
    if (!u)
      return ctx.sendText("Please provide a username. Usage: /banner username");
    return ctx.sendForm({
      emoji: "📊",
      title: `Stats Banner: ${u}`,
      banner: `https://stats.chips.gg/stats/${encodeURIComponent(u)}`,
      buttonLabel: "View Profile",
      url: `https://chips.gg/user/${encodeURIComponent(u)}`,
    });
  },
};

const compare = {
  name: "compare",
  description: "Compare two users' stats. Usage: /compare username1 username2",
  options: {
    username1: S("First Chips.gg username", true),
    username2: S("Second Chips.gg username", true),
  },
  handler: (ctx) => {
    const a = arg(ctx, "username1", 1);
    const b = arg(ctx, "username2", 2);
    if (!a || !b)
      return ctx.sendText(
        "Please provide both usernames. Usage: /compare username1 username2"
      );
    return ctx.sendForm({
      emoji: "🔄",
      title: `Comparing ${a} vs ${b}`,
      banner: `https://stats.chips.gg/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`,
      buttonLabel: "View Profiles",
      url: `https://chips.gg/user/${encodeURIComponent(a)}`,
    });
  },
};

const stats = {
  name: "stats",
  description: "Player stats by username. Usage: /stats username [start] [end]",
  options: { username: usernameOpt, start: startOpt, end: endOpt },
  handler: async (ctx, { api }) => {
    const username = arg(ctx, "username", 1);
    if (!username)
      return ctx.sendText(
        "Please provide a username. Usage: /stats username [start] [end]"
      );
    const startArg = arg(ctx, "start", 2);
    const endArg = arg(ctx, "end", 3);
    const explicit = Boolean(startArg || endArg);
    const period = dateRange(startArg, endArg);
    if (period.error) return ctx.sendText(period.error);
    try {
      const player = await api.public("getPlayer", { userid: username });
      if (!player?.id) return ctx.sendText(`User "${username}" not found.`);
      // getPlayer ignores start/end; getUserStats honours them (or a duration enum)
      const s =
        (await api.public(
          "getUserStats",
          explicit
            ? { userid: player.id, start: period.start, end: period.end }
            : { userid: player.id, duration: "1m" }
        )) || {};
      const vip = player.vip || {};
      return ctx.sendForm({
        emoji: "👤",
        title: `Player: ${player.username}`,
        content: [
          `**Period:** ${explicit ? `${period.startLabel} — ${period.endLabel}` : "last 30 days"}`,
          `**Rank:** ${vip.rank || "Unranked"}${vip.level ? ` (level ${vip.level})` : ""}`,
          `**Bets:** ${formatInt(s.count)}`,
          `**Wagered:** $${formatUsd(s.wageredUsd)}`,
          `**Bonuses:** $${formatUsd(s.bonusesUsd)}`,
          `**PnL:** ${formatSignedUsd(s.pnlUsd)}`,
          `**Joined:** ${player.created ? new Date(player.created).toISOString().slice(0, 10) : "unknown"}`,
        ].join("\n"),
        url: `https://chips.gg/user/${player.username}`,
        buttonLabel: "View Profile",
      });
    } catch (e) {
      return ctx.sendText(
        `Could not fetch stats for "${username}": ${e.message}`
      );
    }
  },
};

// ---- identity commands (need a Discord/Telegram user; hidden from the HTTP demo) ----

const linkaccount = {
  name: "linkaccount",
  description: "Link your Chips.gg account (requires 2FA code).",
  options: {
    username: S("Your Chips.gg username", true),
    totp: S("Your 6-digit 2FA code", true),
  },
  identity: true,
  ephemeral: true,
  handler: async (ctx, { api, env }) => {
    if (ctx.platform === "telegram" && !ctx.isPrivate) {
      await ctx.deleteMessage?.();
      return ctx.sendText(
        "For your security, link your account in a private chat with me: open my profile, press Start, then send `/linkaccount <username> <6-digit code>`."
      );
    }
    const username = arg(ctx, "username", 1);
    const totp = arg(ctx, "totp", 2);
    if (!username || !/^\d{6}$/.test(totp || "")) {
      return ctx.sendText(
        `Please provide your username and a 6-digit 2FA code.\nUsage: ${ctx.platform === "discord" ? "/linkaccount username:<name> totp:<code>" : "/linkaccount <name> <code>"}`
      );
    }
    console.info("[linkaccount] attempt", {
      platform: ctx.platform,
      platformid: String(ctx.userid),
      username,
    });
    try {
      const account = await api.auth("linkPlatformID", {
        platformid: String(ctx.userid),
        platform: ctx.platform,
        userid: username,
        code: Number(totp),
      });
      const player = await api.public("getPlayer", { userid: account.userid });
      const lines = [
        `Your ${ctx.platform} account is now linked to **${player.username}**.`,
      ];
      if (player?.vip?.rank) lines.push(`VIP rank: ${player.vip.rank}`);
      // Rank roles exist only in the Chips guild; never PUT roles in other servers the bot sits in
      if (
        ctx.platform === "discord" &&
        ctx.guildId &&
        ctx.guildId === env.DISCORD_ROLES_GUILD_ID
      ) {
        const roleId = discordRoleForRank(player?.vip?.rank);
        if (
          roleId &&
          (await assignDiscordRole(env, ctx.guildId, ctx.userid, roleId))
        )
          lines.push("Discord role updated.");
      }
      return ctx.sendForm({
        emoji: "🔐",
        title: "Account Linked",
        content: lines.join("\n"),
        buttonLabel: "Visit Profile",
        url: `https://chips.gg/user/${player.username}`,
        ephemeral: true,
      });
    } catch (e) {
      console.error("[linkaccount] failed:", e.message);
      return ctx.sendText(
        `Failed to link account: ${e.message}\nCheck the username and that the 2FA code is current.`
      );
    }
  },
};

const notLinked = (extra = "") => ({
  emoji: "🔗",
  title: "No Linked Account",
  content: `You don't have a Chips.gg account linked yet.\nUse **/linkaccount** to connect your account.${extra}`,
  buttonLabel: "Chips.gg",
  url: "https://chips.gg",
  ephemeral: true,
});

const checkaccount = {
  name: "checkaccount",
  description: "Check your linked Chips.gg account.",
  identity: true,
  ephemeral: true,
  handler: async (ctx, { api }) => {
    const p = await linkedAccount(api, ctx);
    if (!p) return ctx.sendForm(notLinked());
    const lines = [
      `**Username:** ${p.username}`,
      `**Platform:** ${ctx.platform}`,
    ];
    if (p.nickname && p.nickname !== p.username)
      lines.push(`**Nickname:** ${p.nickname}`);
    return ctx.sendForm({
      emoji: "✅",
      title: "Linked Account",
      content: lines.join("\n"),
      buttonLabel: "View Profile",
      url: `https://chips.gg/user/${p.username}`,
      ephemeral: true,
    });
  },
};

const myaffiliates = {
  name: "myaffiliates",
  description:
    "Your own affiliate campaign stats. Usage: /myaffiliates [start] [end]",
  options: { start: startOpt, end: endOpt },
  identity: true,
  ephemeral: true,
  handler: async (ctx, { api }) => {
    const period = dateRange(arg(ctx, "start", 1), arg(ctx, "end", 2));
    if (period.error) return ctx.sendText(period.error);
    const user = await linkedAccount(api, ctx);
    if (!user) return ctx.sendForm(notLinked());
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
        ephemeral: true,
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
  },
};

const affiliateCmd = {
  name: "affiliate",
  description:
    "Staff: affiliate stats for any user. Usage: /affiliate username [start] [end]",
  options: { username: usernameOpt, start: startOpt, end: endOpt },
  identity: true,
  staffOnly: true,
  ephemeral: true,
  handler: async (ctx, { api }) => {
    const username = arg(ctx, "username", 1);
    if (!username)
      return ctx.sendText(
        "Please provide a username. Usage: /affiliate username [start] [end]"
      );
    const period = dateRange(arg(ctx, "start", 2), arg(ctx, "end", 3));
    if (period.error) return ctx.sendText(period.error);
    const caller = await linkedAccount(api, ctx);
    if (!caller)
      return ctx.sendText(
        "Link your Chips.gg account first with /linkaccount, then try again."
      );
    if (!(await isStaff(api, caller)))
      return ctx.sendText("You are not authorized to use this command.");
    const user = await api.public("getPlayer", { userid: username });
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
        ephemeral: true,
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
      ephemeral: true,
    });
  },
};

export const commands = Object.fromEntries(
  [
    help,
    affiliateCmd,
    banner,
    bet,
    bigwins,
    chat,
    checkaccount,
    compare,
    koth,
    linkaccount,
    luckiest,
    mostplayed,
    myaffiliates,
    prices,
    promotion,
    promotions,
    search,
    slotcall,
    stats,
  ].map((c) => [c.name, c])
);

// Discord application-command payload (used by scripts/register-discord.js and /health)
export const discordCommandPayload = () =>
  Object.values(commands).map((c) => ({
    name: c.name,
    description: c.description.slice(0, 100),
    options: c.options
      ? Object.entries(c.options).map(([name, o]) => ({
          name,
          description: o.description.slice(0, 100),
          type: o.type,
          required: Boolean(o.required),
        }))
      : undefined,
  }));
