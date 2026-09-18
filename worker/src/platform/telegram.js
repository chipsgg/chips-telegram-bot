/**
 * Telegram webhook (Bot API over fetch, no Telegraf).
 * Register once:  POST https://api.telegram.org/bot<TOKEN>/setWebhook
 *                 { url: "https://bot.chips.gg/telegram", secret_token: <TELEGRAM_WEBHOOK_SECRET>,
 *                   allowed_updates: ["message"], drop_pending_updates: true }
 * Telegram sends X-Telegram-Bot-Api-Secret-Token on every update; we reject mismatches.
 *
 * Markdown -> Telegram HTML is done here with a tiny converter covering what the
 * forms actually use: **bold**, *italic*, `code`, [text](url), line breaks.
 */
import { commands } from "../commands/index.js";
import { tokenGetter, tokenize } from "../lib/format.js";

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

export function telegramMakeForm({ emoji = "", title = "", content, footer }) {
  const head =
    `${emoji.trim()} <b>${esc(title.trim())}</b> ${emoji.trim()}`.trim();
  const body = mdToTelegramHtml(content || "");
  return `${head}\n${body}${footer ? `\n\n${mdToTelegramHtml(footer)}` : ""}`;
}

const linkKeyboard = (url, label) =>
  url && label
    ? { inline_keyboard: [[{ text: label.slice(0, 64), url }]] }
    : undefined;

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
        json.description || res.status
      );
    return json;
  };
}

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
    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendPhoto`,
      { method: "POST", body: fd }
    );
    const json = await res.json().catch(() => ({}));
    if (!json.ok)
      console.warn(
        "[telegram] sendPhoto(bytes) failed:",
        json.description || res.status
      );
    return json;
  } catch (err) {
    console.warn("[telegram] sendPhotoBytes error:", err.message);
    return null;
  }
}

function makeCtx(message, send, env) {
  const tokens = tokenize(message.text);
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

export async function handleTelegram(request, env, deps, waitUntil) {
  if (
    env.TELEGRAM_WEBHOOK_SECRET &&
    request.headers.get("x-telegram-bot-api-secret-token") !==
      env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return new Response("forbidden", { status: 403 });
  }
  const update = await request.json().catch(() => null);
  const message = update?.message;
  if (!message?.text) return new Response("ok");

  const name = commandName(message);
  const command = name && commands[name];
  if (!command) return new Response("ok");

  const send = tgApi(env);
  const ctx = makeCtx(message, send, env);
  waitUntil(
    (async () => {
      // liveness first: the platform delivered to us, whatever the handler does next
      await deps.feed?.mark("telegram");
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
