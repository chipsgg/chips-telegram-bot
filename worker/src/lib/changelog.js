/**
 * Changelog source for the landing page: GitHub Releases, trimmed to what we render.
 *
 * Two sources, same output shape:
 *   1. REST API (structured, has markdown bodies). Unauthenticated = 60 req/h per IP, and
 *      Cloudflare's egress IPs are shared, so from a Worker this often 403s.
 *   2. releases.atom (public repo, no quota). Bodies are rendered HTML, which we turn back
 *      into the same {summary, notes[]} shape. Used whenever the API refuses.
 * Callers memoise (FeedCore.memo) so neither is hit more than every few minutes.
 */
export const CHANGELOG_REPO = "chipsgg/chips-telegram-bot";

export async function fetchChangelog(env, fetchImpl = fetch) {
  const ua = `chips-bot/${env.VERSION || "dev"}`;
  try {
    return await fromApi(ua, fetchImpl);
  } catch (apiErr) {
    try {
      return await fromAtom(ua, fetchImpl);
    } catch (atomErr) {
      throw new Error(`changelog: ${apiErr.message}; atom: ${atomErr.message}`);
    }
  }
}

async function fromApi(ua, fetchImpl) {
  const r = await fetchImpl(
    `https://api.github.com/repos/${CHANGELOG_REPO}/releases?per_page=12`,
    {
      headers: { accept: "application/vnd.github+json", "user-agent": ua },
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
}

async function fromAtom(ua, fetchImpl) {
  const r = await fetchImpl(
    `https://github.com/${CHANGELOG_REPO}/releases.atom`,
    { headers: { "user-agent": ua }, signal: AbortSignal.timeout(8000) }
  );
  if (!r.ok) throw new Error(`github ${r.status}`);
  return parseAtom(await r.text());
}

// Atom entries -> the same shape as the API path. Exported for tests.
export function parseAtom(xml) {
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const pick = (tag) =>
      (e.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1];
    const url = (e.match(/<link[^>]+href="([^"]+)"/) || [])[1] || null;
    const tag = url
      ? decodeURIComponent(url.split("/releases/tag/")[1] || "")
      : null;
    if (!tag) continue;
    const title = unescapeHtml(pick("title") || tag).trim();
    const body = htmlToNotesMarkdown(unescapeHtml(pick("content") || ""));
    out.push({
      tag,
      name: title || tag,
      date: pick("updated") || null,
      url,
      summary: changelogSummary(body),
      notes: changelogLines(body),
    });
  }
  return out;
}

// Rendered release HTML -> the markdown-ish text the two parsers below already understand.
function htmlToNotesMarkdown(html) {
  return html
    .replace(/<h\d[^>]*>([\s\S]*?)<\/h\d>/g, "\n## $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_, inner) => `\n* ${inner.trim()}`)
    .replace(/<\/(p|ul|ol|div)>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, text) => {
      const t = stripTags(text).trim();
      // GitHub renders "@user" and PR links; keep the shape changelogLines expects
      return /\/pull\/\d+/.test(href) ? href : t;
    })
    .split("\n")
    .map((l) => stripTags(l).replace(/\s+/g, " ").trim())
    .join("\n");
}

const stripTags = (s) => s.replace(/<[^>]+>/g, "");
const unescapeHtml = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

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
        !/^\*{0,2}Full Changelog/.test(l)
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
      .filter((l) => !/by @?(dependabot|renovate)(\[bot\])?\b/i.test(l))
      .map((l) => {
        const m = l
          .slice(2)
          .match(
            /^(.*?)(?:\s+by\s+@?[\w-]+(?:\[bot\])?)?(?:\s+in\s+(https:\/\/github\.com\/\S+\/pull\/(\d+)))?\s*$/
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
