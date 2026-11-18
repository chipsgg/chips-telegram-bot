/**
 * Telegram webhook (Bot API over fetch, no Telegraf).
 * Register once:  POST https://api.telegram.org/bot<TOKEN>/setWebhook
 *                 { url: "https://bot.chips.gg/telegram", secret_token: <TELEGRAM_WEBHOOK_SECRET>,
 *                   allowed_updates: ["message", "callback_query"], drop_pending_updates: true }
 * (callback_query carries the support inbox's CSAT taps; scripts/register-telegram.js sets both.)
 * Telegram sends X-Telegram-Bot-Api-Secret-Token on every update; we reject mismatches.
 *
 * Markdown -> Telegram HTML is done here with a tiny converter covering what the
 * forms actually use: **bold**, *italic*, `code`, [text](url), line breaks.
 */
import { commands, linkPrompt } from "../commands/index.js";
import { parseCsat, relayInbound, storeFile } from "../inbox.js";
import { tokenGetter, tokenize } from "../lib/format.js";
import { resolveLink } from "../lib/links.js";
import { rateLimitMessage } from "../lib/ratelimit.js";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Minimal inline-markdown -> Telegram HTML
export function mdToTelegramHtml(md) {
  const links = [];
  let s = String(md || "").replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_, text, url) => {
      links.push({ text, url });
      return `\uE000${links.length - 1}\uE000`;
    }
  );
  s = esc(s);
  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<i>$2</i>");
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  s = s.replace(/^-# /gm, ""); // discord subtext marker
  s = s.replace(
    /\uE000(\d+)\uE000/g,
    (_, i) => `<a href="${esc(links[i].url)}">${esc(links[i].text)}</a>`
  );
  return s;
}

/**
 * Form -> Telegram HTML caption. A form may carry a `telegram` override block for a layout
 * tuned to a phone screen (Telegram has no embed fields/author/color, so announcements
 * collapse the receipt into one line instead of stacking labelled rows).
 */
export function telegramMakeForm(form) {
  const f = form.telegram ? { ...form, ...form.telegram } : form;
  const { emoji = "", title = "", content, footer, fields, plainTitle } = f;
  const head = plainTitle
    ? `${emoji.trim()} <b>${esc(title.trim())}</b>`.trim()
    : `${emoji.trim()} <b>${esc(title.trim())}</b> ${emoji.trim()}`.trim();
  const body = mdToTelegramHtml(content || "");
  const rows = (fields || [])
    .map(
      (x) =>
        `<b>${esc(String(x.name))}:</b> ${mdToTelegramHtml(String(x.value))}`
    )
    .join("\n");
  const main = [head, body, rows].filter(Boolean).join("\n");
  return footer ? `${main}\n\n${mdToTelegramHtml(footer)}` : main;
}

const linkKeyboard = (url, label) =>
  url && label
    ? { inline_keyboard: [[{ text: label.slice(0, 64), url }]] }
    : undefined;

// Post a form to a chat/channel (proactive announcements). No reply_to, no banner upload.
export async function postTelegramChat(env, chatId, form) {
  if (!env.TELEGRAM_TOKEN) return false;
  const keyboard = multiLinkKeyboard(form);
  const caption = telegramMakeForm(form);
  // announcements carry an image (game thumbnail / promo banner): photo + caption
  const photo = form.photo || form.banner;
  if (photo) {
    const r = await sendPhotoBytes(
      env,
      chatId,
      photo,
      caption.slice(0, 1024),
      keyboard
    );
    if (r?.ok) return true;
  }
  const r = await tgApi(env)("sendMessage", {
    chat_id: chatId,
    text: caption.slice(0, 4096),
    parse_mode: "HTML",
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  });
  return Boolean(r?.ok);
}

// primary button + any extra link buttons on one row
const multiLinkKeyboard = (form) => {
  const row = [];
  if (form.url && form.buttonLabel)
    row.push({ text: form.buttonLabel.slice(0, 64), url: form.url });
  for (const b of form.buttons || [])
    if (b?.url && b?.label)
      row.push({ text: b.label.slice(0, 64), url: b.url });
  return row.length ? { inline_keyboard: [row] } : undefined;
};

export function tgApi(env) {
  const base = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}`;
  return async (method, body) => {
    const res = await fetch(`${base}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!json.ok)
      console.warn(
        `[telegram] ${method} failed:`,
        json.description || "no description"
      );
    return json;
  };
}

const tgUpload = async (env, method, fd) => {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`,
    { method: "POST", body: fd }
  );
  return res.json().catch(() => ({}));
};

// Download an image and upload it via multipart sendPhoto (Telegram won't fetch dynamic URLs)
async function sendPhotoBytes(env, chatId, url, caption, reply_markup) {
  try {
    const img = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; chips-bot/4.0)" },
    });
    const type = img.headers.get("content-type") || "";
    if (!img.ok || !type.startsWith("image/")) {
      console.warn("[telegram] banner fetch failed:", img.status, type);
      return null;
    }
    const blob = await img.blob();
    if (blob.size > 10 * 1024 * 1024) return null;
    const fd = new FormData();
    fd.append("chat_id", String(chatId));
    fd.append("caption", caption);
    fd.append("parse_mode", "HTML");
    if (reply_markup) fd.append("reply_markup", JSON.stringify(reply_markup));
    fd.append("photo", blob, `banner.${type.includes("png") ? "png" : "jpg"}`);
    const json = await tgUpload(env, "sendPhoto", fd);
    if (!json.ok)
      console.warn(
        "[telegram] sendPhoto(bytes) failed:",
        json.description || "no description"
      );
    return json;
  } catch (err) {
    console.warn("[telegram] sendPhotoBytes error:", err.message);
    return null;
  }
}

function makeCtx(message, send, env) {
  const tokens = tokenize(message.text ?? message.caption ?? "");
  const getString = tokenGetter(tokens);
  const chatId = message.chat.id;
  const reply = (extra) =>
    send("sendMessage", {
      chat_id: chatId,
      reply_to_message_id: message.message_id,
      allow_sending_without_reply: true,
      ...extra,
    });
  return {
    platform: "telegram",
    userid: message.from?.id,
    chatid: chatId,
    isPrivate: message.chat.type === "private",
    getString,
    rest: (from = 1) => tokens.slice(from).join(" "),
    sendText: (text) =>
      reply({ text: mdToTelegramHtml(text), parse_mode: "HTML" }),
    sendForm: async (form) => {
      const reply_markup = linkKeyboard(form.url, form.buttonLabel);
      if (form.banner) {
        // Telegram fetches photo URLs itself and rejects dynamically rendered ones
        // (stats.chips.gg banners). Fetch the bytes here and upload them instead.
        const r = await sendPhotoBytes(
          env,
          chatId,
          form.banner,
          telegramMakeForm(form).slice(0, 1024),
          reply_markup
        );
        if (r?.ok) return r;
      }
      const tail = form.banner
        ? `\n\n<a href="${esc(form.banner)}">🖼 View image</a>`
        : "";
      return reply({
        text: `${telegramMakeForm(form)}${tail}`.slice(0, 4096),
        parse_mode: "HTML",
        reply_markup,
        link_preview_options: { is_disabled: !form.banner },
      });
    },
    deleteMessage: () =>
      send("deleteMessage", {
        chat_id: chatId,
        message_id: message.message_id,
      }),
  };
}

// "/stats@chipsgg_bot foo" -> "stats"
const commandName = (message) => {
  const ent = (message.entities || []).find(
    (e) => e.type === "bot_command" && e.offset === 0
  );
  if (!ent) return null;
  return message.text.slice(1, ent.length).split("@")[0].toLowerCase();
};

/**
 * Which command a Telegram message runs, or null to stay silent.
 *   /cmd anywhere            -> cmd
 *   bare text, private chat  -> start   (link status, or the link flow with the host as the reason)
 *   bare text + @bot, group  -> help
 *   bare group chatter       -> null    (never answer general chatter)
 */
export function resolveTelegramCommand(message, botUsername) {
  const name = commandName(message);
  if (name) return name;
  if (message.chat?.type === "private") return "start";
  const botUser = (botUsername || "").toLowerCase();
  const mentioned =
    botUser &&
    (message.entities || []).some(
      (e) =>
        e.type === "mention" &&
        message.text.slice(e.offset, e.offset + e.length).toLowerCase() ===
          `@${botUser}`
    );
  return mentioned ? "help" : null;
}

export async function handleTelegram(request, env, deps, waitUntil) {
  // fail closed: an update reaches the support inbox, so an unset secret is a refusal, never an open door
  if (
    !env.TELEGRAM_WEBHOOK_SECRET ||
    request.headers.get("x-telegram-bot-api-secret-token") !==
      env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return new Response("forbidden", { status: 403 });
  }
  const update = await request.json().catch(() => null);
  if (update?.callback_query && env.RELAY) {
    waitUntil(telegramCsat(update.callback_query, env));
    return new Response("ok");
  }
  const message = update?.message;
  // Support inbox: a private non-command message from a person (text, photo or file)
  if (
    env.RELAY &&
    message?.chat?.type === "private" &&
    (message.text || message.photo || message.document) &&
    !(message.text && commandName(message))
  ) {
    waitUntil(telegramInbound(update, env, deps));
    return new Response("ok");
  }
  if (!message?.text) return new Response("ok");

  const send = tgApi(env);
  const ctx = makeCtx(message, send, env);

  const name = resolveTelegramCommand(message, env.TELEGRAM_BOT_USERNAME);
  if (!name) return new Response("ok");
  const command = commands[name];
  if (!command) return new Response("ok");
  waitUntil(
    (async () => {
      // liveness first: the platform delivered to us, whatever the handler does next
      await deps.feed?.mark("telegram");
      const rl = await deps.feed.ratelimit(`telegram:${ctx.userid}`);
      if (!rl.allowed) {
        await ctx.sendText(rateLimitMessage(rl.retryAfterSec));
        return;
      }
      try {
        await command.handler(ctx, deps);
        await deps.metrics.track("telegram", name, true);
      } catch (err) {
        console.error(`[telegram] /${name} failed:`, err.message);
        await deps.metrics.track("telegram", name, false);
        await ctx.sendText("Something went wrong running that command.");
      }
    })()
  );
  return new Response("ok");
}

const SORRY =
  "Sorry, your message didn't reach the team. Please try again in a minute.";

/**
 * A private message into the support inbox. Linked: files to R2 (tg/), RELAY.inbound with
 * idem tg:<update_id> (Telegram redelivers the same update_id), then the relay's auto-reply.
 * Unlinked: the link prompt and nothing stored.
 */
export async function telegramInbound(update, env, deps) {
  const m = update.message;
  const ctx = makeCtx(m, tgApi(env), env);
  try {
    await deps.feed?.mark("telegram");
    const link = await resolveLink(deps, "telegram", String(m.from?.id));
    if (!link) return await ctx.sendForm(linkPrompt(ctx));
    const attachments = [];
    const file = m.document || m.photo?.at(-1); // photo sizes ascend; take the largest
    if (file) {
      const got = await tgApi(env)("getFile", { file_id: file.file_id });
      if (!got.ok) throw new Error(`getFile: ${got.description}`);
      const a = await storeFile(env, "tg", update.update_id, {
        url: `https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${got.result.file_path}`,
        name: m.document?.file_name || "photo.jpg",
        type: m.document
          ? m.document.mime_type || "application/octet-stream"
          : "image/jpeg",
        size: file.file_size || 0,
      });
      if (a.error) return await ctx.sendText(a.error);
      attachments.push(a);
    }
    const r = await relayInbound(env, {
      channel: "telegram",
      link,
      platformId: m.chat.id,
      idem: `tg:${update.update_id}`,
      extId: m.message_id,
      text: m.text ?? m.caption,
      attachments,
    });
    if (r?.error) throw new Error(r.error);
    if (r?.auto?.text) await ctx.sendText(r.auto.text);
  } catch (err) {
    console.error("[inbox] telegram inbound failed:", err.message);
    await ctx.sendText(SORRY);
  }
}

// A CSAT tap (callback_data csat:<token>:<n>): record it, drop the buttons, say thanks.
export async function telegramCsat(q, env) {
  const send = tgApi(env);
  const vote = parseCsat(q.data);
  let text = "Thanks for the rating!";
  try {
    const r = vote ? await env.RELAY.csat(vote) : { error: "bad button" };
    if (!r?.ok) text = "That rating was already recorded or has expired.";
    else if (q.message)
      await send("editMessageReplyMarkup", {
        chat_id: q.message.chat.id,
        message_id: q.message.message_id,
        reply_markup: { inline_keyboard: [] },
      });
  } catch (err) {
    console.error("[inbox] csat failed:", err.message);
    text = "Couldn't record that, please try again.";
  }
  await send("answerCallbackQuery", { callback_query_id: q.id, text });
}

const tgThrow = (r) => {
  if (r?.ok) return r.result;
  throw new Error(
    r?.error_code === 403
      ? "blocked by user"
      : r?.description || "telegram error"
  );
};

/**
 * InboxBridge.send on Telegram: "<b>label</b>\ntext" with the CSAT keyboard, then each file
 * (fetched from its signed URL and uploaded: the URL expires). ext_id is the text message.
 * ponytail: a failed file after the text throws, so the relay's retry repeats the text too.
 */
export async function telegramSend(
  env,
  { platform_id, label, text, attachments = [], buttons = [] }
) {
  const msg = tgThrow(
    await tgApi(env)("sendMessage", {
      chat_id: platform_id,
      text: `<b>${esc(label)}</b>\n${esc(String(text || "").slice(0, 3900))}`,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(buttons.length
        ? {
            reply_markup: {
              inline_keyboard: [
                buttons.map((b) => ({ text: b.text, callback_data: b.data })),
              ],
            },
          }
        : {}),
    })
  );
  for (const a of attachments) {
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(`attachment fetch ${res.status}: ${a.name}`);
    const photo = /^image\/(jpeg|png)$/.test(a.type);
    const fd = new FormData();
    fd.append("chat_id", String(platform_id));
    fd.append(photo ? "photo" : "document", await res.blob(), a.name);
    tgThrow(await tgUpload(env, photo ? "sendPhoto" : "sendDocument", fd));
  }
  return { ext_id: String(msg.message_id) };
}

// InboxBridge.notify: a companion push, with the Mini App behind a web_app button.
export async function telegramNotify(env, { platform_id, text, url }) {
  const msg = tgThrow(
    await tgApi(env)("sendMessage", {
      chat_id: platform_id,
      text: esc(String(text || "").slice(0, 4000)),
      parse_mode: "HTML",
      ...(url
        ? {
            reply_markup: {
              inline_keyboard: [[{ text: "Open", web_app: { url } }]],
            },
          }
        : {}),
    })
  );
  return { ext_id: String(msg.message_id) };
}
