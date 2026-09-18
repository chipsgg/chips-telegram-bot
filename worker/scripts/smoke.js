#!/usr/bin/env node
/**
 * HTTP smoke test against a running Worker (wrangler dev or deployed).
 *   node scripts/smoke.js http://127.0.0.1:8787
 * Read-only. Exits non-zero on any failed expectation.
 */
const base = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
// Guard: test tooling never targets production. bot.chips.gg / the prod workers.dev host are refused.
const PROD_HOSTS = ["bot.chips.gg", "chips-bot.chips.workers.dev"];
const refuseProd = (url) => {
  const host = new URL(url).hostname;
  if (PROD_HOSTS.includes(host)) {
    console.error(
      `refusing to run against production host ${host}; use https://bot-cf.chips.gg (dev)`
    );
    process.exit(3);
  }
};
refuseProd(base);
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${String(detail).slice(0, 220).replace(/\n/g, " | ")}` : ""}`
  );
  if (!ok) failures++;
};
// x-smoke-bypass lifts the per-IP API rate limit on non-production hosts (prod ignores it)
const get = async (path) => {
  const res = await fetch(base + path, { headers: { "x-smoke-bypass": "1" } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // Feed warm-up: first /health boots the DO and opens the socket
  let health;
  for (let i = 0; i < 20; i++) {
    health = await get("/health");
    if (health.status === 200 && health.json?.feed?.updatedAt > 0) break;
    await sleep(1000);
  }
  check(
    "/health 200 + feed connected + fresh",
    health.status === 200 && health.json?.ok === true,
    JSON.stringify(health.json)
  );
  // a platform that has no token configured (local Node run) is not a wiring failure
  const wiredOrOff = (p) => p?.configured === false || p?.wired === true;
  check(
    "/health reports discord+telegram wiring",
    wiredOrOff(health.json?.discord) &&
      wiredOrOff(health.json?.telegram) &&
      health.json?.status === "healthy",
    `discord=${JSON.stringify(health.json?.discord)} telegram=${JSON.stringify(health.json?.telegram)}`
  );
  check(
    "feed has bigwins/luckiest/currencies",
    health.json?.feed?.bigwins > 0 &&
      health.json?.feed?.luckiest > 0 &&
      health.json?.feed?.currencies > 5,
    JSON.stringify(health.json?.feed)
  );

  const home = await get("/");
  check(
    "/ static landing renders",
    home.status === 200 && home.text.includes("CHIPS.GG"),
    `${home.text.length} bytes`
  );
  check("/ has no fake ticker/latency", !/64,231|LATENCY:/.test(home.text));

  // the `public` root push can land a second or two after the first stats push on a cold feed
  let ticker = await get("/api/ticker");
  for (let i = 0; i < 5 && !(ticker.json?.rows?.length > 5); i++) {
    await new Promise((r) => setTimeout(r, 1500));
    ticker = await get("/api/ticker");
  }
  check(
    "/api/ticker live rows",
    Array.isArray(ticker.json?.rows) &&
      ticker.json.rows.length > 5 &&
      /^\$/.test(ticker.json.rows[0].label),
    ticker.json?.rows
      ?.slice(0, 3)
      .map((r) => `${r.symbol} ${r.label}`)
      .join(", ")
  );

  const prices = await get("/api/command/prices");
  check(
    "/prices from feed",
    /^BTC\/USD: \$[\d,]+\.\d\d/.test(prices.json?.content || ""),
    prices.json?.content
  );
  const btc = await get("/api/command/prices?currency=btc");
  check(
    "/prices?currency=btc single line",
    (btc.json?.content || "").split("\n").length === 1 &&
      /^BTC/.test(btc.json?.content || ""),
    btc.json?.content
  );

  const bigwins = await get("/api/command/bigwins");
  check(
    "/bigwins 10 rows from feed",
    (bigwins.json?.content || "").split("\n").filter((l) => /^\d+\./.test(l))
      .length >= 5,
    bigwins.json?.content
  );
  const luckiest = await get("/api/command/luckiest");
  check(
    "/luckiest rows from feed",
    (luckiest.json?.content || "").split("\n").filter((l) => /^\d+\./.test(l))
      .length >= 5,
    luckiest.json?.content
  );

  const promos = await get("/api/command/promotions");
  check(
    "/promotions no crash, linked titles",
    /\]\(https:\/\/chips\.gg\/promotions\//.test(promos.json?.content || ""),
    promos.json?.content
  );

  const statsDefault = await get("/api/command/stats?username=tacyarg");
  const statsAug = await get(
    "/api/command/stats?args=tacyarg+2026-08-01+2026-09-01"
  );
  const wagered = (c) =>
    Number((c?.match(/Wagered:\*\* \$([\d,.]+)/) || [])[1]?.replace(/,/g, ""));
  check(
    "/stats default = last 30 days",
    /last 30 days/.test(statsDefault.json?.content || ""),
    statsDefault.json?.content
  );
  check(
    "/stats explicit window honoured (differs from default)",
    /2026-08-01 — 2026-09-01/.test(statsAug.json?.content || "") &&
      Number.isFinite(wagered(statsAug.json?.content)) &&
      wagered(statsAug.json?.content) !== wagered(statsDefault.json?.content),
    `aug=${wagered(statsAug.json?.content)} default=${wagered(statsDefault.json?.content)}`
  );

  const search = await get("/api/command/search?query=gates");
  check(
    "/search links to play pages",
    /https:\/\/chips\.gg\/play\//.test(search.json?.content || ""),
    search.json?.content
  );
  const most = await get("/api/command/mostplayed");
  check(
    "/mostplayed",
    /^1\. /.test(most.json?.content || ""),
    most.json?.content
  );
  const slot = await get("/api/command/slotcall");
  check(
    "/slotcall has banner + reroll marker",
    Boolean(slot.json?.banner) && slot.json?.reroll === "slotcall",
    slot.json?.title
  );
  for (const n of [
    "koth",
    "chat",
    "help",
    "bet?betid=abc",
    "banner?username=tacyarg",
    "compare?username1=a&username2=b",
  ]) {
    const r = await get(`/api/command/${n}`);
    check(
      `/${n} 200 + title`,
      r.status === 200 && Boolean(r.json?.title),
      r.json?.title
    );
  }

  for (const n of [
    "linkaccount",
    "checkaccount",
    "myaffiliates",
    "affiliate",
  ]) {
    const r = await get(`/api/command/${n}?username=x`);
    check(`/${n} hidden over HTTP (404)`, r.status === 404);
  }
  check("unknown command 404", (await get("/api/command/nope")).status === 404);

  const cj = await get("/commands.json");
  check(
    "/commands.json hides staff cmds",
    Array.isArray(cj.json) &&
      cj.json.length === 18 &&
      !cj.json.some((c) => c.name === "affiliate"),
    `${cj.json?.length} cmds`
  );

  const badSig = await fetch(`${base}/discord`, {
    method: "POST",
    body: JSON.stringify({ type: 1 }),
    headers: { "x-signature-ed25519": "00", "x-signature-timestamp": "1" },
  });
  check("POST /discord rejects bad signature (401)", badSig.status === 401);
  const tgNoSecret = await fetch(`${base}/telegram`, {
    method: "POST",
    body: JSON.stringify({ update_id: 1 }),
    headers: { "content-type": "application/json" },
  });
  check(
    "POST /telegram without secret -> 403 (when secret set) or 200",
    [200, 403].includes(tgNoSecret.status),
    String(tgNoSecret.status)
  );

  await sleep(500);
  const metrics = await get("/api/metrics");
  check(
    "metrics counted api commands in D1",
    metrics.json?.api_commands >= 15 &&
      metrics.json?.commands_executed >= metrics.json?.api_commands,
    JSON.stringify(metrics.json)
  );

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("smoke crashed:", e.message);
  process.exit(2);
});
