/**
 * Telegram Bot Connector
 * Manages the Telegram bot lifecycle using Telegraf, including command registration,
 * message handling, group tracking, polling with reconnect logic, and broadcasting.
 */
const assert = require("assert");
const _ = require("lodash");
const marked = require("marked");
const { Telegraf } = require("telegraf");
const { trackCommand } = require("../metrics");

const noop = () => undefined;

// Parse inline markdown and sanitize line breaks for Telegram HTML messages
const parseAndClean = (content) =>
  _.replace(marked.parseInline(_.trim(content)), "<br>", "\n");

// Build an HTML-formatted message string for Telegram with emoji, title, content, and footer
const telegramMakeForm = ({ emoji, title, content, footer }) => `${_.trim(
  emoji
)} <strong>${_.trim(title)}</strong> ${_.trim(emoji)}
${parseAndClean(content)}${footer ? `\n\n${parseAndClean(footer)}` : ""}`;

// Inline keyboard with a single URL button, or none when url/label missing
const linkKeyboard = (url, buttonLabel) => ({
  inline_keyboard: url && buttonLabel ? [[{ text: buttonLabel, url }]] : [],
});

// Split the message into whitespace-separated tokens; tokens[0] is the /command itself
const tokenize = (text) => _.compact(_.split(_.trim(text || ""), /\s+/));

// Context wrapper that normalizes Telegram messages into a unified command interface
const WrapperTelegram = (context) => {
  const message = context.message || context.update?.message || {};
  const tokens = tokenize(message.text);

  console.log("[telegram] command", {
    chat: message.chat?.id,
    from: message.from?.id,
    text: message.text,
  });

  function sendForm(options) {
    const { banner, url, buttonLabel } = options;
    const caption = telegramMakeForm(options);
    if (banner) {
      return context.replyWithPhoto(
        { url: banner },
        {
          caption,
          parse_mode: "HTML",
          reply_markup: linkKeyboard(url, buttonLabel),
        }
      );
    }
    return context.replyWithHTML(caption, {
      reply_markup: linkKeyboard(url, buttonLabel),
    });
  }

  function sendText(content) {
    return context.replyWithHTML(parseAndClean(content));
  }

  // Delete the triggering message (needs "Delete messages" admin right in groups)
  const deleteMessage = () => context.deleteMessage();

  // Positional argument: /cmd arg1 arg2 -> getArg(1) === "arg1"
  const getArg = (index) => tokens[index];

  // Named argument: accepts `key:value` or `key=value` anywhere in the message,
  // falling back to the positional token at `index` when no named form is present.
  const getString = (key, index = 1) => {
    const named = tokens.find(
      (t) => t.startsWith(`${key}:`) || t.startsWith(`${key}=`)
    );
    if (named) return named.slice(key.length + 1) || undefined;
    return tokens[index];
  };

  const getNumber = (key, index = 1) => {
    const n = Number.parseFloat(getString(key, index));
    return Number.isNaN(n) ? undefined : n;
  };

  return {
    platform: "telegram",
    userid: message.from?.id,
    chatid: message.chat?.id,
    chatType: message.chat?.type,
    isPrivate: message.chat?.type === "private",
    sendForm,
    sendText,
    deleteMessage,
    getArg,
    getString,
    getNumber,
  };
};

// Track bot instance and reconnection state for graceful restarts
let botInstance = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 5000;

// Broadcast targets: seeded from TELEGRAM_BROADCAST_CHATS (comma-separated chat ids),
// then grown with any group/supergroup the bot sees a message in.
const seedBroadcastChats = () =>
  _.chain(process.env.TELEGRAM_BROADCAST_CHATS || "")
    .split(",")
    .map((s) => Number.parseInt(_.trim(s), 10))
    .filter((n) => Number.isFinite(n))
    .uniq()
    .value();

// Launch the Telegram bot with polling, register command handlers, and set up broadcasting
module.exports = async (token, commands) => {
  const startBot = async () => {
    try {
      // If there's an existing instance, stop it first
      if (botInstance) {
        try {
          await botInstance.stop();
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (err) {
          console.log("Error stopping previous bot instance:", err);
        }
      }

      return new Promise((resolve, reject) => {
        const allGroups = seedBroadcastChats();
        const addGroup = (id) => {
          if (!_.includes(allGroups, id)) {
            allGroups.push(id);
          }
        };
        const isGroupChat = (chat) =>
          chat && (chat.type === "group" || chat.type === "supergroup");

        const bot = new Telegraf(token);
        botInstance = bot;

        _.forEach(_.keys(commands), (commandName) => {
          bot.command(commandName, async (ctx) => {
            const { message } = ctx.update;
            assert(message, "requires message");
            assert(message.chat, "requires chat");

            if (isGroupChat(message.chat)) addGroup(message.chat.id);

            const wrapper = WrapperTelegram(ctx);
            try {
              await Promise.resolve(commands[commandName].handler(wrapper));
              await trackCommand("telegram");
            } catch (error) {
              console.error(`[telegram] /${commandName} failed:`, error);
              await ctx
                .reply("Something went wrong running that command.")
                .catch(noop);
            }
          });
        });

        bot.on("message", (ctx) => {
          const chat = ctx.update.message?.chat;
          if (isGroupChat(chat)) addGroup(chat.id);
        });

        const sendTo = (chatId, fn) =>
          fn(chatId).catch((e) =>
            console.error(
              `[telegram] broadcast to ${chatId} failed:`,
              e.message
            )
          );

        // Send a plain HTML text message to all tracked groups
        function broadcastText(message) {
          assert(message, "requires message");
          _.forEach(allGroups, (groupId) =>
            sendTo(groupId, (id) =>
              bot.telegram.sendMessage(id, parseAndClean(message), {
                parse_mode: "HTML",
              })
            )
          );
        }

        // Broadcast a rich form (with optional banner image) to all tracked groups
        function broadcastForm(options) {
          const { banner, url, buttonLabel } = options;
          const caption = telegramMakeForm(options);
          const extra = {
            parse_mode: "HTML",
            reply_markup: linkKeyboard(url, buttonLabel),
          };
          _.forEach(allGroups, (groupId) =>
            sendTo(groupId, (id) =>
              banner
                ? bot.telegram.sendPhoto(
                    id,
                    { url: banner },
                    { caption, ...extra }
                  )
                : bot.telegram.sendMessage(id, caption, extra)
            )
          );
        }

        // Enable graceful stop
        process.once("SIGINT", () => bot.stop("SIGINT"));
        process.once("SIGTERM", () => bot.stop("SIGTERM"));

        console.log("Attempting to start Telegram bot...");
        bot
          .launch(
            {
              dropPendingUpdates: true,
              allowedUpdates: ["message", "callback_query"],
              polling: {
                timeout: 30,
                limit: 100,
              },
            },
            () => {
              console.log(
                `[telegram] started as @${bot.botInfo?.username} (broadcast seeds: ${allGroups.length})`
              );
              resolve({
                broadcastText,
                broadcastForm,
                cleanup: () => bot.stop(),
              });
            }
          )
          .catch(async (error) => {
            console.error("Failed to start Telegram bot. Details:", {
              errorName: error.name,
              errorMessage: error.message,
              errorCode: error.response?.error_code,
              description: error.response?.description,
            });

            // On 409 conflict (another instance running), retry with backoff
            if (
              error.response?.error_code === 409 &&
              reconnectAttempts < MAX_RECONNECT_ATTEMPTS
            ) {
              reconnectAttempts++;
              console.log(
                `Retrying bot connection in ${RECONNECT_DELAY / 1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
              );
              await new Promise((resolve) =>
                setTimeout(resolve, RECONNECT_DELAY)
              );
              return startBot();
            }

            reject(error);
          });
      });
    } catch (error) {
      console.error("Error in startBot:", error);
      throw error;
    }
  };

  return startBot();
};

module.exports.WrapperTelegram = WrapperTelegram;
module.exports.telegramMakeForm = telegramMakeForm;
