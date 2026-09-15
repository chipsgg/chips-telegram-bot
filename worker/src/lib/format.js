/**
 * Formatting + argument helpers (ESM, no Node deps).
 * Ported from src/libs/utils.js; behaviour covered by worker/test/format.test.js.
 */

// Read a named/positional command argument identically on every platform.
// ctx.getString(name, index) is implemented per platform (see platform/*.js).
export const arg = (ctx, name, index = 1) => {
  const raw = ctx.getString(name, index);
  if (raw === undefined || raw === null) return undefined;
  const value = String(raw).trim();
  return value.length ? value : undefined;
};

export const argNumber = (ctx, name, index = 1) => {
  const raw = arg(ctx, name, index);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

// Optional YYYY-MM-DD range -> ms epoch. Defaults: start of current UTC month .. now.
export const dateRange = (startInput, endInput, now = new Date()) => {
  const start = startInput
    ? Date.parse(startInput)
    : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = endInput ? Date.parse(endInput) : now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return {
      error: "Invalid date format. Please use YYYY-MM-DD (e.g. 2026-01-15).",
    };
  }
  if (end < start) return { error: "End date must be after start date." };
  return { start, end, startLabel: formatDay(start), endLabel: formatDay(end) };
};

const usd2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const int0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const formatUsd = (num) => usd2.format(Number(num || 0));
export const formatInt = (num) => int0.format(Math.round(Number(num || 0)));

// Signed dollars: "-$1,234.50" / "$1,234.50"
export const formatSignedUsd = (num) => {
  const n = Number(num || 0);
  return `${n < 0 ? "-" : ""}$${formatUsd(Math.abs(n))}`;
};

// Compact currency: "$76,086.01", "$0.3369", "$0.00000508" (sub-dollar = 4 significant digits)
export const formatPrice = (num) => {
  const n = Number(num || 0);
  if (n >= 1) return `$${usd2.format(n)}`;
  if (n === 0) return "$0.00";
  const digits = Math.min(8, Math.max(2, 3 - Math.floor(Math.log10(n))));
  return `$${n.toFixed(digits)}`;
};

// Human number with up to `max` decimals, trailing zeros trimmed: 1,344.87x
export const formatNumber = (num, max = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: max }).format(
    Number(num || 0)
  );

export const formatDay = (date) => new Date(date).toISOString().slice(0, 10);

// "28 Sep 2026 17:00 UTC"
export const formatDate = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "unknown";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${d.getUTCFullYear()} ${hh}:${mm} UTC`;
};

// "in 3d 4h" / "in 52m" / "ended"
export const timeUntil = (date, now = Date.now()) => {
  const ms = new Date(date).getTime() - now;
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "ended";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins % 60}m`;
  return `in ${mins}m`;
};

// Base-unit amount -> USD using the currency record {decimals, price}
export const toUsd = (amount, currency) => {
  if (!currency) return 0;
  return (
    (Number(amount || 0) / 10 ** Number(currency.decimals || 0)) *
    Number(currency.price || 0)
  );
};

// Whitespace tokens of a Telegram-style message; tokens[0] is the /command
export const tokenize = (text) =>
  String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

// Telegram-style getString: `key:value` / `key=value` token wins, else positional token
export const tokenGetter =
  (tokens) =>
  (key, index = 1) => {
    const named = tokens.find(
      (t) => t.startsWith(`${key}:`) || t.startsWith(`${key}=`)
    );
    if (named) return named.slice(key.length + 1) || undefined;
    return tokens[index];
  };
