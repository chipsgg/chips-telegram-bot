#!/usr/bin/env node
/**
 * HTTP smoke test against a running bot instance.
 *   node scripts/smoke.js [baseUrl]
 * Exits non-zero if any expectation fails. No secrets, read-only.
 */
const base = process.argv[2] || `http://localhost:${process.env.PORT || 5000}`;
let failures = 0;

const check = (label, ok, detail = "") => {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`
  );
  if (!ok) failures++;
};

const get = async (path) => {
  const res = await fetch(base + path);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
};

(async () => {
  const health = await get("/health");
  check(
    "/health 200 + sdk connected",
    health.status === 200 && health.json?.sdk === "connected",
    JSON.stringify(health.json)
  );

  const home = await get("/");
  check(
    "/ renders",
    home.status === 200 && home.text.includes("CHIPS.GG"),
    `${home.text.length} bytes`
  );

  const promos = await get("/api/command/promotions");
  check(
    "/promotions no crash, has content",
    promos.status === 200 &&
      typeof promos.json?.content === "string" &&
      promos.json.content.length > 20,
    (promos.json?.content || promos.text).slice(0, 160).replace(/\n/g, " | ")
  );

  const stats = await get(
    "/api/command/stats?args=tacyarg+2026-08-01+2026-09-01"
  );
  check(
    "/stats positional args + explicit period",
    stats.json?.content?.includes("2026-08-01 — 2026-09-01") &&
      /Wagered/.test(stats.json.content),
    (stats.json?.content || stats.text).slice(0, 200).replace(/\n/g, " | ")
  );

  const statsNamed = await get("/api/command/stats?username=tacyarg");
  const wagered = (c) =>
    Number((c?.match(/Wagered:\*\* \$([\d,.]+)/) || [])[1]?.replace(/,/g, ""));
  check(
    "/stats explicit window differs from trailing-30d default",
    statsNamed.json?.content?.includes("last 30 days") &&
      Number.isFinite(wagered(stats.json?.content)) &&
      wagered(stats.json?.content) !== wagered(statsNamed.json?.content),
    `aug=${wagered(stats.json?.content)} default=${wagered(statsNamed.json?.content)}`
  );
  check(
    "/stats named arg",
    /Player: tacyarg/.test(statsNamed.json?.title || ""),
    statsNamed.json?.title
  );

  const search = await get("/api/command/search?query=gates");
  check(
    "/search links to play pages",
    /https:\/\/chips\.gg\/play\//.test(search.json?.content || ""),
    (search.json?.content || search.text).slice(0, 160).replace(/\n/g, " | ")
  );

  const prices = await get("/api/command/prices?currency=BTC");
  check(
    "/prices?currency=BTC filters",
    /^BTC\/USD/.test(prices.json?.content || ""),
    prices.json?.content
  );

  const pricesBad = await get("/api/command/prices?currency=NOPE");
  check(
    "/prices unknown currency -> friendly text",
    /not found/i.test(pricesBad.json?.text || ""),
    pricesBad.json?.text
  );

  for (const name of [
    "linkaccount",
    "checkaccount",
    "myaffiliates",
    "affiliate",
  ]) {
    const r = await get(`/api/command/${name}?username=x`);
    check(`/${name} hidden over HTTP (404)`, r.status === 404);
  }

  const unknown = await get("/api/command/doesnotexist");
  check("unknown command 404", unknown.status === 404);

  for (const name of [
    "mostplayed",
    "bigwins",
    "luckiest",
    "slotcall",
    "koth",
    "chat",
    "help",
  ]) {
    const r = await get(`/api/command/${name}`);
    check(
      `/${name} 200 + title`,
      r.status === 200 && !!r.json?.title,
      r.json?.title
    );
  }

  const metrics = await get("/api/metrics");
  check(
    "metrics counted api commands",
    metrics.json?.api_commands >= 10 &&
      metrics.json?.commands_executed === metrics.json?.api_commands,
    JSON.stringify(metrics.json)
  );

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("smoke crashed:", e.message);
  process.exit(2);
});
