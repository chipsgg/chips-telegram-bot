import assert from "node:assert/strict";
import { test } from "node:test";
import {
  arg,
  dateRange,
  formatDate,
  formatPrice,
  formatSignedUsd,
  formatUsd,
  timeUntil,
  toUsd,
  tokenGetter,
  tokenize,
} from "../src/lib/format.js";

const tg = (text) => {
  const t = tokenize(text);
  return {
    platform: "telegram",
    getString: tokenGetter(t),
    rest: (from = 1) => t.slice(from).join(" "),
  };
};

test("telegram tokens: positional + named override + @botname", () => {
  const ctx = tg(
    "/affiliate@chipsgg_bot end=2026-02-01  sousa start:2026-01-01"
  );
  assert.equal(arg(ctx, "username", 2), "sousa");
  assert.equal(arg(ctx, "start", 3), "2026-01-01");
  assert.equal(arg(ctx, "end", 4), "2026-02-01");
  assert.equal(arg(ctx, "missing", 9), undefined);
  assert.equal(arg(tg("/bet betid:"), "betid", 1), undefined);
  assert.equal(tg("/search gates of olympus").rest(1), "gates of olympus");
});

test("dateRange defaults + validation", () => {
  const now = new Date("2026-09-15T14:00:00Z");
  const r = dateRange(undefined, undefined, now);
  assert.equal(r.start, Date.UTC(2026, 8, 1));
  assert.equal(r.startLabel, "2026-09-01");
  assert.equal(r.endLabel, "2026-09-15");
  assert.match(dateRange("nope").error, /YYYY-MM-DD/);
  assert.match(dateRange("2026-02-01", "2026-01-01").error, /after start/);
});

test("formatters", () => {
  assert.equal(formatUsd(1234.5), "1,234.50");
  assert.equal(formatSignedUsd(-12.3), "-$12.30");
  assert.equal(formatPrice(76086.01), "$76,086.01");
  assert.equal(formatPrice(0.3369), "$0.3369");
  assert.equal(formatPrice(0.00000508), "$0.00000508");
  assert.equal(
    formatDate(Date.UTC(2026, 8, 28, 17, 0)),
    "28 Sep 2026 17:00 UTC"
  );
  const now = Date.UTC(2026, 8, 15);
  assert.equal(timeUntil(now + 3 * 86400000 + 4 * 3600000, now), "in 3d 4h");
  assert.equal(timeUntil(now - 1, now), "ended");
  // 3095655 base units of SOL (9 decimals) at $98.55
  assert.equal(
    Math.round(toUsd(3095655, { decimals: 9, price: 98.55 }) * 1000) / 1000,
    0.305
  );
});
