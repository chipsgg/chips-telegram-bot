#!/usr/bin/env node
/**
 * Cut a release: bump semver, sync package.json versions to it, commit, tag, push.
 *   npm run release -- patch|minor|major        (or an explicit 4.2.0)
 *   npm run release -- minor --no-push          (tag locally, push yourself)
 *
 * Refuses on a dirty tree or off master. The tag push triggers .github/workflows/release.yml,
 * which runs tests and deploys production with the tag stamped in. Without CI secrets,
 * deploy by hand afterwards: `npm run deploy` (it verifies the tag matches).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sh = (cmd, opts = {}) =>
  execSync(cmd, { stdio: ["ignore", "pipe", "inherit"], ...opts })
    .toString()
    .trim();
const root = sh("git rev-parse --show-toplevel");
const [bump = "patch", ...rest] = process.argv.slice(2);
const push = !rest.includes("--no-push");

const branch = sh("git rev-parse --abbrev-ref HEAD");
if (branch !== "master" && !rest.includes("--allow-branch")) {
  console.error(
    `releases are cut from master (on ${branch}); pass --allow-branch to override`
  );
  process.exit(2);
}
if (sh("git status --porcelain -- . ':!scratch'")) {
  console.error("working tree is dirty; commit or stash first");
  process.exit(2);
}
sh("git fetch --tags -q");

const latest = (() => {
  try {
    return sh(
      "git describe --tags --match 'v[0-9]*.[0-9]*.[0-9]*' --abbrev=0 HEAD"
    ).slice(1);
  } catch {
    return "0.0.0";
  }
})();
let next;
if (/^\d+\.\d+\.\d+$/.test(bump)) next = bump;
else {
  const [M, m, p] = latest.split(".").map(Number);
  next = {
    major: `${M + 1}.0.0`,
    minor: `${M}.${m + 1}.0`,
    patch: `${M}.${m}.${p + 1}`,
  }[bump];
  if (!next) {
    console.error(`unknown bump "${bump}" (patch|minor|major|X.Y.Z)`);
    process.exit(2);
  }
}
const tag = `v${next}`;
if (sh(`git tag -l ${tag}`)) {
  console.error(`${tag} already exists`);
  process.exit(2);
}

// keep package.json versions honest
for (const rel of ["package.json", "worker/package.json"]) {
  const p = resolve(root, rel);
  const pkg = JSON.parse(readFileSync(p, "utf8"));
  pkg.version = next;
  writeFileSync(p, `${JSON.stringify(pkg, null, 2)}\n`);
}
sh("git add package.json worker/package.json");
sh(`git commit -q -m "release ${tag}"`);
sh(`git tag -a ${tag} -m "${tag}"`);
console.log(
  `${latest} -> ${next}  (tag ${tag}, commit ${sh("git rev-parse --short=7 HEAD")})`
);

if (push) {
  sh(`git push -q origin ${branch}`);
  sh(`git push -q origin ${tag}`);
  console.log(
    `pushed ${branch} + ${tag}. Release workflow will deploy production if CLOUDFLARE_API_TOKEN is set; otherwise: cd worker && npm run deploy`
  );
} else {
  console.log(
    `not pushed. When ready: git push origin ${branch} && git push origin ${tag}`
  );
}
