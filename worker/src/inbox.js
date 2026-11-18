/**
 * Support inbox: the bot's side of Chips Desk (plan phase 1).
 *
 * Doors:
 *   in  - Telegram private messages and the Discord Reply-button modal reach the relay through
 *         the RELAY service binding (`inbound`, `csat`); platform code calls relayInbound/storeFile.
 *   out - the relay calls the InboxBridge entrypoint (src/index.js: send, verifyInitData, notify),
 *         which lands on telegramSend/telegramNotify, discordSend and verifyInitData below.
 * Only linked accounts reach the inbox; an unlinked user gets the link prompt and nothing is
 * stored (no R2 object either). Player files go to R2 binding FILES under tg/ or dc/.
 * The class itself lives in src/index.js: `cloudflare:workers` is Cloudflare-only code.
 */
import { resolveLink } from "./lib/links.js";

const MiB = 1024 * 1024;
// Mirrors the relay's LIMITS (vipdesk relay/src/attachments.js); the relay re-checks.
export const maxBytes = (type) =>
  String(type).startsWith("video/") ? 50 * MiB : 10 * MiB;

const safeName = (name) =>
  String(name || "file")
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(-120);

/**
 * Copy a player's file into R2 as `<prefix>/<id>/<name>`. `prefix` is tg or dc, `id` the
 * update/interaction id. Returns the relay's attachment shape or {error} for the player.
 */
export async function storeFile(env, prefix, id, { url, name, type, size }) {
  if (size > maxBytes(type))
    return { error: `That file is too big (max ${maxBytes(type) / MiB} MB).` };
  const res = await fetch(url);
  if (!res.ok) throw new Error(`file fetch ${res.status}`);
  const body = await res.arrayBuffer();
  const key = `${prefix}/${id}/${safeName(name)}`;
  await env.FILES.put(key, body, { httpMetadata: { contentType: type } });
  return { key, name: String(name || "file"), type, size: body.byteLength };
}

/** RELAY.inbound for a linked player. Returns the relay's result ({conv, msg, auto?} | {error}). */
export function relayInbound(
  env,
  { channel, link, platformId, idem, extId, text, attachments }
) {
  return env.RELAY.inbound({
    channel,
    player: `uid:${link.uid}`,
    name: link.username || undefined,
    verified: true,
    text: text || "",
    idem,
    platform_id: String(platformId),
    ext_id: String(extId),
    ...(attachments?.length ? { attachments } : {}),
  });
}

/** "csat:<token>:<1-5>" -> {token, score}, else null. */
export function parseCsat(data) {
  const m = /^csat:([^:]+):([1-5])$/.exec(String(data || ""));
  return m ? { token: m[1], score: Number(m[2]) } : null;
}

const enc = (s) => new TextEncoder().encode(s);
const hmacKey = (raw, usage) =>
  crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
const MAX_AGE_S = 24 * 3600;

/**
 * Telegram Mini App initData check (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * secret = HMAC("WebAppData", bot token); hash = HMAC(secret, sorted "k=v" lines without hash).
 * -> {platform_id, uid|null} or {error}. uid comes from the linked-account registry.
 */
export async function verifyInitData(
  deps,
  { init_data } = {},
  now = Date.now()
) {
  const token = deps.env?.TELEGRAM_TOKEN;
  if (!token || typeof init_data !== "string")
    return { error: "bad init_data" };
  const params = new URLSearchParams(init_data);
  const hash = params.get("hash") || "";
  params.delete("hash");
  const check = [...params]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(enc("WebAppData"), "sign"),
    enc(token)
  );
  const sig = new Uint8Array(
    (hash.match(/../g) || []).map((h) => parseInt(h, 16))
  );
  const ok =
    /^[0-9a-f]{64}$/.test(hash) &&
    (await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, "verify"),
      sig,
      enc(check)
    ));
  if (!ok) return { error: "bad signature" };
  if (!(now / 1000 - Number(params.get("auth_date")) < MAX_AGE_S))
    return { error: "expired" };
  let id = null;
  try {
    id = JSON.parse(params.get("user") || "{}").id;
  } catch {
    id = null;
  }
  if (!id) return { error: "no user" };
  try {
    const link = await resolveLink(deps, "telegram", String(id));
    return { platform_id: String(id), uid: link?.uid ?? null };
  } catch (err) {
    console.error("[inbox] initData lookup failed:", err.message);
    return { error: "lookup failed" };
  }
}
