const { test } = require("node:test");
const assert = require("node:assert/strict");
const affiliate = require("../src/libs/models/affiliate");
const events = require("../src/libs/models/events");
const { telegramMakeForm } = require("../src/libs/connectors/telegram");

const campaign = (over = {}) => ({
  signups: 10,
  done: false,
  stats: {
    ftd: 3,
    bets: 500,
    depositUsd: 1000,
    wageredUsd: 20000,
    commissionUsd: 20,
    bonusUsd: 180,
    profitUsd: -700, // negative = house profit
  },
  ...over,
});

test("affiliate.aggregate sums campaign rows only", () => {
  const t = affiliate.aggregate([
    campaign(),
    campaign({ done: true, signups: 5 }),
  ]);
  assert.equal(t.campaigns, 2);
  assert.equal(t.active, 1);
  assert.equal(t.signups, 15);
  assert.equal(t.ftd, 6);
  assert.equal(t.bets, 1000);
  assert.equal(t.wageredUsd, 40000);
  assert.equal(t.commissionUsd, 40);
  assert.equal(t.bonusUsd, 360);
  assert.equal(t.codeProfitUsd, 1400);
});

test("affiliate.aggregate tolerates missing stats", () => {
  const t = affiliate.aggregate([{ signups: 1 }, { stats: null }]);
  assert.equal(t.signups, 1);
  assert.equal(t.wageredUsd, 0);
});

test("affiliate.render hides cost lines for players, shows them for staff", () => {
  const base = {
    user: { username: "sousa" },
    period: { startLabel: "2026-09-01", endLabel: "2026-09-15" },
    totals: affiliate.aggregate([campaign()]),
    referrals: [
      { user: { username: "whale" }, wageredUsd: 15000, depositUsd: 800 },
    ],
  };
  const player = affiliate.render({ ...base, staff: false });
  const staff = affiliate.render({ ...base, staff: true });
  assert.match(player, /Commission: \$20\.00/);
  assert.doesNotMatch(player, /Code profit/);
  assert.doesNotMatch(player, /Bonuses handed/);
  assert.match(staff, /Code profit \(house\): \$700\.00/);
  assert.match(staff, /Bonuses handed to referrals: \$180\.00/);
  assert.match(staff, /1\. \*\*whale\*\* — \$15,000\.00 wagered/);
});

test("events model: empty and populated", () => {
  assert.match(events([]).content, /no active events/i);
  const now = Date.now();
  const form = events([
    {
      promotionid: "10kraff",
      title: "$10,000 Weekly Raffle",
      endTime: now + 2 * 86400000,
      subtitle: "",
      description: "## Rules\n\nEvery $10 wagered = 1 ticket. Draw Sunday.",
    },
    {
      promotionid: "2kbtb",
      title: "Beat The Boss",
      endTime: now + 3600000,
      subtitle: "Hit 500x on any slot",
    },
  ]);
  // sorted by endTime ascending -> Beat The Boss first
  assert.ok(
    form.content.indexOf("Beat The Boss") <
      form.content.indexOf("Weekly Raffle")
  );
  assert.match(
    form.content,
    /\[\$10,000 Weekly Raffle\]\(https:\/\/chips\.gg\/promotions\/10kraff\)/
  );
  assert.match(form.content, /Every \$10 wagered = 1 ticket\. Draw Sunday\./);
  assert.match(form.content, /Hit 500x on any slot/);
  assert.match(form.content, /Ends in 1d 23h|Ends in 2d 0h/);
});

test("telegramMakeForm renders markdown to Telegram HTML", () => {
  const html = telegramMakeForm({
    emoji: "📊",
    title: "T",
    content: "**bold** and [link](https://chips.gg)\nline2",
    footer: "f",
  });
  assert.match(html, /<strong>T<\/strong>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="https:\/\/chips\.gg">link<\/a>/);
  assert.match(html, /\nline2/);
  assert.match(html, /\n\nf$/);
});
