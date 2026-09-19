/**
 * Changelog source for the landing page: GitHub Releases, trimmed to what we render.
 * Unauthenticated GitHub API = 60 requests/hour, so callers memoise (FeedCore.memo).
 */
export const CHANGELOG_REPO = "chipsgg/chips-telegram-bot";
export async function fetchChangelog(env, fetchImpl = fetch) {
  try {
    const r = await fetchImpl(
      `https://api.github.com/repos/${CHANGELOG_REPO}/releases?per_page=12`,
      {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": `chips-bot/${env.VERSION || "dev"}`,
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!r.ok) throw new Error(`github ${r.status}`);
    const list = await r.json();
    return (Array.isArray(list) ? list : [])
      .filter((x) => !x.draft && !x.prerelease)
      .map((x) => ({
        tag: x.tag_name,
        name: x.name || x.tag_name,
        date: x.published_at,
        url: x.html_url,
        summary: changelogSummary(x.body || ""),
        notes: changelogLines(x.body || ""),
      }));
  } catch (err) {
    throw new Error(`changelog: ${err.message}`);
  }
}

// First prose paragraph under the heading (the release's one-line story), if the author wrote one.
export function changelogSummary(body) {
  const line = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(
      (l) =>
        l &&
        !l.startsWith("#") &&
        !l.startsWith("* ") &&
        !l.startsWith("- ") &&
        !l.startsWith("**Full Changelog")
    );
  return line ? line.replace(/`/g, "") : null;
}

// "* Title by @who in https://github.com/.../pull/112" -> { text, pr, prUrl }; drop headings/footer
export function changelogLines(body) {
  return (
    body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("* ") || l.startsWith("- "))
      // dependency-bot bumps are noise on a product changelog
      .filter((l) => !/by @(dependabot|renovate)(\[bot\])?\b/i.test(l))
      .map((l) => {
        const m = l
          .slice(2)
          .match(
            /^(.*?)(?:\s+by\s+@[\w-]+(?:\[bot\])?)?(?:\s+in\s+(https:\/\/github\.com\/\S+\/pull\/(\d+)))?\s*$/
          );
        return m
          ? {
              text: m[1].trim(),
              pr: m[3] ? Number(m[3]) : null,
              prUrl: m[2] || null,
            }
          : { text: l.slice(2), pr: null, prUrl: null };
      })
      .filter((x) => x.text)
      .slice(0, 12)
  );
}
