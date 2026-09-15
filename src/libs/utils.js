/**
 * Shared Utility Functions
 * Common helpers used across the bot for argument parsing, formatting,
 * broadcasting, rate limiting, and general-purpose data structures.
 */
const _ = require("lodash");
const fs = require("fs");

/**
 * Read a command argument the same way on every platform.
 *   Discord  -> slash-command option `name`
 *   API      -> query-string param `name`
 *   Telegram -> `name:value` / `name=value` token, else positional token `index`
 * Returns undefined when absent (never null / empty string).
 */
exports.arg = (ctx, name, index = 1) => {
  let raw;
  if (ctx.platform === "telegram") {
    raw = ctx.getString(name, index);
  } else {
    // discord.js getString() throws on a Number-typed option; fall through to getNumber
    try {
      raw = ctx.getString?.(name);
    } catch {
      raw = undefined;
    }
    if (raw === undefined || raw === null) {
      try {
        raw = ctx.getNumber?.(name);
      } catch {
        raw = undefined;
      }
    }
    // API ?args=a+b+c (and Discord option order) as a positional fallback
    if (raw === undefined || raw === null) {
      raw = ctx.getArg?.(index);
    }
  }
  if (raw === undefined || raw === null) return undefined;
  const value = String(raw).trim();
  return value.length ? value : undefined;
};

// Numeric variant of arg(); undefined when absent or not a number
exports.argNumber = (ctx, name, index = 1) => {
  const raw = exports.arg(ctx, name, index);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Resolve an optional YYYY-MM-DD date range to ms epoch.
 * Defaults to the start of the current UTC month .. now.
 * Returns { start, end, startLabel, endLabel } or { error }.
 */
exports.dateRange = (startInput, endInput, now = new Date()) => {
  const start = startInput
    ? Date.parse(startInput)
    : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = endInput ? Date.parse(endInput) : now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return {
      error: "Invalid date format. Please use YYYY-MM-DD (e.g. 2026-01-15).",
    };
  }
  if (end < start) {
    return { error: "End date must be after start date." };
  }
  return {
    start,
    end,
    startLabel: exports.formatDay(start),
    endLabel: exports.formatDay(end),
  };
};

// Format a number as a USD string with two decimal places
exports.formatUsd = (num) =>
  Number(num || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Format an integer with thousands separators
exports.formatInt = (num) =>
  Math.round(Number(num || 0)).toLocaleString("en-US");

// "2026-09-28" (UTC)
exports.formatDay = (date) => new Date(date).toISOString().slice(0, 10);

// "28 Sep 2026 17:00 UTC"
exports.formatDate = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "unknown";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${d.getUTCFullYear()} ${hh}:${mm} UTC`;
};

// "in 3d 4h" / "in 52m" / "ended"
exports.timeUntil = (date, now = Date.now()) => {
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

// Format a number with a variable number of decimal places (min 2, max 8)
exports.convertDecimals = (num, decimals) =>
  Number(num).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals < 2 ? 2 : Math.min(8, decimals),
  });

// Return an array of subdirectory names within the given path
exports.getDirectories = (path) => {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path + "/" + file).isDirectory();
  });
};

// Create a broadcast function that invokes a named method across all connectors
exports.makeBroadcast =
  (listMethods, funcName) =>
  (...args) =>
    _.forEach(listMethods, (methods) => _.get(methods, funcName)(...args));

// Fixed-size stack that evicts the oldest items when the max capacity is reached
exports.Stack = class {
  constructor(maxsize) {
    this.stack = [];
    this.maxsize = maxsize;
  }
  push(...elements) {
    for (let i = 0; i < elements.length; i++) {
      while (this.stack.length >= this.maxsize) {
        this.stack.splice(0, 1);
      }
      this.stack.push(elements[i]);
    }
  }
  pop() {
    if (this.stack.length === 0) throw new Error("Underflow");
    return this.stack.pop();
  }
  *popAll() {
    while (!this.isEmpty()) {
      yield this.pop();
    }
  }
  top() {
    if (this.isEmpty()) throw new Error("no items in stack");
    return this.stack[this.stack.length - 1];
  }
  length() {
    return this.stack.length;
  }
  isEmpty() {
    return this.stack.length === 0;
  }
};

// Return a promise that resolves after t milliseconds
exports.sleep = (t) => new Promise((resolve) => setTimeout(resolve, t));

// In-memory rate limiter keyed by user ID
const rateLimit = new Map();

// Returns true if the user is allowed to proceed; false if within the cooldown window
exports.checkRateLimit = (userId, limitMs = 1000) => {
  const now = Date.now();
  const lastRequest = rateLimit.get(userId) || 0;
  if (now - lastRequest < limitMs) {
    return false;
  }
  rateLimit.set(userId, now);
  return true;
};
