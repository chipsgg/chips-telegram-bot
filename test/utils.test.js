const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  arg,
  argNumber,
  dateRange,
  formatUsd,
  formatInt,
  formatDate,
  timeUntil,
} = require("../src/libs/utils");

const tgCtx = (text) => {
  const { WrapperTelegram } = require("../src/libs/connectors/telegram");
  return WrapperTelegram({
    message: { text, from: { id: 42 }, chat: { id: -100, type: "supergroup" } },
    replyWithHTML: async (x) => x,
    replyWithPhoto: async (x) => x,
    deleteMessage: async () => undefined,
  });
};

const discordCtx = (options) => ({
  platform: "discord",
  getString: (k) => (typeof options[k] === "string" ? options[k] : null),
  getNumber: (k) => (typeof options[k] === "number" ? options[k] : null),
});

const apiCtx = (query) => ({
  platform: "api",
  getString: (k) => (query[k] === undefined ? undefined : String(query[k])),
});

test("arg: telegram positional", () => {
  const ctx = tgCtx("/stats tacyarg 2026-09-01 2026-09-15");
  assert.equal(arg(ctx, "username", 1), "tacyarg");
  assert.equal(arg(ctx, "start", 2), "2026-09-01");
  assert.equal(arg(ctx, "end", 3), "2026-09-15");
  assert.equal(arg(ctx, "missing", 4), undefined);
});

test("arg: telegram named key:value and key=value override position", () => {
  const ctx = tgCtx("/affiliate end=2026-02-01 sousa start:2026-01-01");
  assert.equal(arg(ctx, "username", 2), "sousa");
  assert.equal(arg(ctx, "start", 3), "2026-01-01");
  assert.equal(arg(ctx, "end", 4), "2026-02-01");
});

test("arg: telegram tolerates extra whitespace and empty named values", () => {
  const ctx = tgCtx("/bet    abc123   ");
  assert.equal(arg(ctx, "betid", 1), "abc123");
  assert.equal(arg(tgCtx("/bet betid:"), "betid", 1), undefined);
});

test("arg: discord options and api query", () => {
  assert.equal(arg(discordCtx({ username: "bob" }), "username"), "bob");
  assert.equal(arg(discordCtx({}), "username"), undefined);
  assert.equal(arg(apiCtx({ username: "  bob " }), "username"), "bob");
  assert.equal(arg(apiCtx({}), "username"), undefined);
});

test("arg: api positional ?args= fallback", () => {
  const positional = ["tacyarg", "2026-08-01"];
  const ctx = { ...apiCtx({}), getArg: (i) => positional[i - 1] };
  assert.equal(arg(ctx, "username", 1), "tacyarg");
  assert.equal(arg(ctx, "start", 2), "2026-08-01");
  assert.equal(arg(ctx, "end", 3), undefined);
  // named wins over positional
  const named = {
    ...apiCtx({ username: "named" }),
    getArg: (i) => positional[i - 1],
  };
  assert.equal(arg(named, "username", 1), "named");
});

test("argNumber", () => {
  assert.equal(argNumber(tgCtx("/x 12.5"), "n", 1), 12.5);
  assert.equal(argNumber(tgCtx("/x abc"), "n", 1), undefined);
  assert.equal(argNumber(discordCtx({ totp: 123456 }), "totp"), 123456);
});

test("telegram wrapper exposes chat metadata", () => {
  const ctx = tgCtx("/help");
  assert.equal(ctx.platform, "telegram");
  assert.equal(ctx.userid, 42);
  assert.equal(ctx.chatid, -100);
  assert.equal(ctx.isPrivate, false);
  assert.equal(typeof ctx.deleteMessage, "function");
});

test("dateRange: defaults to UTC month start .. now", () => {
  const now = new Date("2026-09-15T14:00:00Z");
  const r = dateRange(undefined, undefined, now);
  assert.equal(r.start, Date.UTC(2026, 8, 1));
  assert.equal(r.end, now.getTime());
  assert.equal(r.startLabel, "2026-09-01");
  assert.equal(r.endLabel, "2026-09-15");
});

test("dateRange: explicit, invalid, inverted", () => {
  const ok = dateRange("2026-01-01", "2026-02-01");
  assert.equal(ok.start, Date.UTC(2026, 0, 1));
  assert.equal(ok.end, Date.UTC(2026, 1, 1));
  assert.match(dateRange("nope", undefined).error, /YYYY-MM-DD/);
  assert.match(dateRange("2026-02-01", "2026-01-01").error, /after start/);
});

test("formatters", () => {
  assert.equal(formatUsd(1234.5), "1,234.50");
  assert.equal(formatUsd(undefined), "0.00");
  assert.equal(formatInt(1234.6), "1,235");
  assert.equal(
    formatDate(Date.UTC(2026, 8, 28, 17, 0)),
    "28 Sep 2026 17:00 UTC"
  );
  assert.equal(formatDate("garbage"), "unknown");
  const now = Date.UTC(2026, 8, 15);
  assert.equal(timeUntil(now + 3 * 86400000 + 4 * 3600000, now), "in 3d 4h");
  assert.equal(timeUntil(now + 52 * 60000, now), "in 52m");
  assert.equal(timeUntil(now - 1, now), "ended");
});
