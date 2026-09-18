#!/usr/bin/env node
/**
 * Resolve the build version from git. One source of truth: the nearest `vX.Y.Z` tag.
 *
 *   node scripts/version.js            -> prints JSON {version, commit, builtAt, dirty, release}
 *   node scripts/version.js --wrangler -> prints `--var VERSION:.. --var COMMIT:.. --var BUILT_AT:..`
 *
 * Exactly on a tag, clean tree:  version = "4.1.0",              release = true
 * Ahead of a tag / dirty tree:   version = "4.1.0-3+g403bb4e"    release = false   (dev build)
 * No tag at all:                 version = "0.0.0-0+g<sha>"
 *
 * In GitHub Actions on a tag push, GITHUB_REF_NAME is used directly so a shallow clone
 * still resolves the exact tag.
 */
import { execSync } from "node:child_process";

const sh = (cmd) => {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
};

export function resolveVersion() {
  const commit = sh("git rev-parse --short=7 HEAD") || "unknown";
  const dirty = sh("git status --porcelain -- . ':!scratch'") !== "";
  const refTag = /^v\d+\.\d+\.\d+$/.test(process.env.GITHUB_REF_NAME || "")
    ? process.env.GITHUB_REF_NAME
    : null;

  // describe: v4.1.0 | v4.1.0-3-g403bb4e | (empty when no tags)
  const described =
    refTag ||
    sh("git describe --tags --match 'v[0-9]*.[0-9]*.[0-9]*' --abbrev=7 HEAD");
  let version;
  let release;
  const exact = described.match(/^v(\d+\.\d+\.\d+)$/);
  const ahead = described.match(/^v(\d+\.\d+\.\d+)-(\d+)-g([0-9a-f]+)$/);
  if (exact && !dirty) {
    version = exact[1];
    release = true;
  } else if (exact) {
    version = `${exact[1]}-dirty+g${commit}`;
    release = false;
  } else if (ahead) {
    version = `${ahead[1]}-${ahead[2]}+g${ahead[3]}${dirty ? ".dirty" : ""}`;
    release = false;
  } else {
    version = `0.0.0-0+g${commit}${dirty ? ".dirty" : ""}`;
    release = false;
  }
  return { version, commit, builtAt: new Date().toISOString(), dirty, release };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const v = resolveVersion();
  if (process.argv.includes("--wrangler")) {
    console.log(
      `--var VERSION:${v.version} --var COMMIT:${v.commit} --var BUILT_AT:${v.builtAt}`
    );
  } else {
    console.log(JSON.stringify(v));
  }
}
