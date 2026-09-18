#!/usr/bin/env node
/**
 * Deploy with the build version stamped in.
 *   node scripts/deploy.js            -> production (bot.chips.gg)   requires a clean tree ON a v* tag
 *   node scripts/deploy.js --env dev  -> dev (bot-cf.chips.gg)        any commit, dev version string
 *   node scripts/deploy.js --force    -> production from an untagged/dirty tree (emergency only, logged)
 *
 * After deploying, polls /health until the reported version matches what was pushed.
 */
import { spawnSync } from "node:child_process";
import { resolveVersion } from "./version.js";

const args = process.argv.slice(2);
const envIdx = args.indexOf("--env");
const envName = envIdx >= 0 ? args[envIdx + 1] : null;
const force = args.includes("--force");
const isProd = !envName;

const v = resolveVersion();
if (isProd && !v.release && !force) {
  console.error(`refusing production deploy of non-release build ${v.version}`);
  console.error(
    "tag first:  npm run release -- <major|minor|patch>   (or --force for an emergency hotfix)"
  );
  process.exit(2);
}

const host = isProd ? "bot.chips.gg" : "bot-cf.chips.gg";
console.log(
  `deploying ${v.version} (${v.commit}) -> ${isProd ? "PRODUCTION" : envName} ${host}${force && !v.release ? "  [FORCED non-release]" : ""}`
);

const wrangler = [
  "wrangler",
  "deploy",
  ...(envName ? ["--env", envName] : []),
  "--var",
  `VERSION:${v.version}`,
  "--var",
  `COMMIT:${v.commit}`,
  "--var",
  `BUILT_AT:${v.builtAt}`,
];
const r = spawnSync("npx", wrangler, { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status || 1);

// Verify the edge is serving what we pushed
const deadline = Date.now() + 60_000;
let seen = null;
while (Date.now() < deadline) {
  try {
    const h = await fetch(`https://${host}/health?fresh`).then((x) => x.json());
    seen = h.version;
    if (h.version === v.version) {
      console.log(
        `verified: ${host} reports version ${h.version} commit ${h.commit} (${h.status})`
      );
      if (h.problems?.length) console.log("problems:", h.problems.join(" | "));
      process.exit(h.ok ? 0 : 1);
    }
  } catch {
    seen = seen ?? "unreachable";
  }
  await new Promise((res) => setTimeout(res, 3000));
}
console.error(
  `deployed but ${host} still reports ${seen}, expected ${v.version}`
);
process.exit(1);
