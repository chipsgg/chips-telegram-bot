/**
 * Chips.gg HTTP RPC client for Workers.
 * POST https://api.chips.gg/prod/api/<channel>/<method> with a JSON body.
 * Mirrors the WS SDK's `actions.<channel>(method, params)` so command code ports 1:1.
 *
 * Notes (verified against the live API):
 * - params must be an object; `undefined` crashes server-side destructuring -> always send {}
 * - errors come back as HTTP 500 + a descriptive string body
 * - 503 + HTML = Cloudflare WAF throttle: retry once after a short wait
 * - a browser-ish User-Agent is required or the WAF challenges the request
 */
const UA = "Mozilla/5.0 (compatible; chips-bot/4.0; +https://bot.chips.gg)";

export class ChipsError extends Error {
  constructor(message, { channel, method, status }) {
    super(message);
    this.name = "ChipsError";
    this.channel = channel;
    this.method = method;
    this.status = status;
  }
}

export function createApi({ host, token, fetchImpl }) {
  const base = (host || "https://api.chips.gg/prod/api").replace(/\/$/, "");
  const doFetch = fetchImpl || ((...a) => fetch(...a));

  const RETRY_MS = [500, 1500, 3000];
  // The app-level throttle answers HTTP 500 with this body (not 429). Two commands from one
  // player a couple of seconds apart trip it, so it gets the same backoff as a WAF 503.
  const isThrottle = (status, text) =>
    status === 500 && /please wait|try again later/i.test(text);

  async function call(channel, method, params = {}, attempt = 0) {
    const headers = { "content-type": "application/json", "user-agent": UA };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await doFetch(`${base}/${channel}/${method}`, {
      method: "POST",
      headers,
      body: JSON.stringify(params ?? {}),
    });
    const text = await res.text();

    // WAF throttle / transient upstream: 503, 502, 429 (or the app throttle) -> backoff, retry
    if (
      ([429, 502, 503].includes(res.status) || isThrottle(res.status, text)) &&
      attempt < RETRY_MS.length
    ) {
      console.warn(
        `[chips] ${channel}/${method} -> ${res.status}, retry ${attempt + 1}`
      );
      await new Promise((r) => setTimeout(r, RETRY_MS[attempt]));
      return call(channel, method, params, attempt + 1);
    }
    if (!res.ok) {
      const msg = text.startsWith("<")
        ? `upstream ${res.status}`
        : text.slice(0, 300);
      console.error(
        `[chips] ${channel}/${method} failed ${res.status}: ${msg.slice(0, 120)}`
      );
      throw new ChipsError(msg, { channel, method, status: res.status });
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  const channel = (name) => (method, params) => call(name, method, params);

  return {
    call,
    public: channel("public"),
    auth: channel("auth"),
    private: channel("private"),
    backoffice: channel("backoffice"),
    affiliates: channel("affiliates"),
    hasToken: Boolean(token),
  };
}
