const assert = require("assert");
const _ = require("lodash");
const marked = require("marked");
const { Telegraf } = require("telegraf");

const parseAndClean = (content) =>
  _.replace(marked.parseInline(_.trim(content)), "<br>", "\n");

const telegramMakeForm = ({ emoji, title, content, footer }) => `${_.trim(
  emoji
)} <strong>${_.trim(title)}</strong> ${_.trim(emoji)}
${parseAndClean(content)}${footer ? `\n\n${parseAndClean(footer)}` : ""}`;

const WrapperTelegram = (context) => {
  console.log("WrapperTelegram", context);

  function sendForm(options) {
    const { banner, url, buttonLabel } = options;
    const caption = telegramMakeForm(options);
    if (banner) {
      return context.replyWithPhoto(
        { url: banner },
        {
          caption,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              url && buttonLabel ? [{ text: buttonLabel, url }] : [],
            ],
          },
        }
      );
    } else {
      return context.replyWithHTML(caption, {
        reply_markup: {
          inline_keyboard: [
            url && buttonLabel ? [{ text: buttonLabel, url }] : [],
          ],
        },
      });
    }
  }

  function sendText(content) {
    return context.replyWithHTML(parseAndClean(content));
  }

  const getArg = (index) => context.message.text.split(" ")[index];
  const getString = (string) => {
    // parse all possible arguments for arg:value
    const cmd = context.message.text.split(" ").find((x) => {
      return x.contains(string).split(":")[1];
    });

    return cmd ? cmd : context.message.text.split(" ")[1];
  };

  const getNumber = (string) => {
    return parseInt(getString(string));
  };

  return {
    platform: "telegram",
    userid: context.update.message.from.id,
    sendForm,
    sendText,
    getArg,
    getString,
    getNumber,
  };
};

let botInstance = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 5000;

module.exports = async (token, commands) => {
  const startBot = async () => {
    try {
      // If there's an existing instance, stop it first
      if (botInstance) {
        try {
          await botInstance.stop();
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased cleanup wait time
        } catch (err) {
          console.log("Error stopping previous bot instance:", err);
        }
      }

      return new Promise((resolve, reject) => {
        const allGroups = [147051786];
        const addGroup = (id) => {
          if (!_.includes(allGroups, id)) {
            allGroups.push(id);
          }
        };

        const bot = new Telegraf(token);
        botInstance = bot;

        _.forEach(_.keys(commands), (commandName) => {
          bot.command(commandName, async (ctx) => {
            const { message } = ctx.update;
            const { chat, text: _text } = message;
            assert(message, "requires message");
            assert(chat, "requires chat");

            if (chat.type == "group" || chat.type == "supergroup") {
              addGroup(chat.id);
            }

            const wrapper = WrapperTelegram(ctx);
            await Promise.resolve(commands[commandName].handler(wrapper));
          });
        });

        bot.on("message", (ctx) => {
          const { message } = ctx.update;
          const { chat } = message;
          assert(message, "requires message");
          assert(chat, "requires chat");
          if (chat.type == "group" || chat.type == "supergroup") {
            addGroup(chat.id);
          }
        });

        function broadcastText(message) {
          assert(message, "requires message");
          _.forEach(allGroups, (groupId) =>
            bot.telegram.sendMessage(groupId, parseAndClean(message), {
              parse_mode: "HTML",
            })
          );
        }

        function broadcastForm(options) {
          const { banner, url, buttonLabel } = options;
          const caption = telegramMakeForm(options);
          if (banner) {
            _.forEach(allGroups, (id) =>
              bot.telegram.sendPhoto(
                id,
                { url: banner },
                {
                  caption,
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      url && buttonLabel ? [{ text: buttonLabel, url }] : [],
                    ],
                  },
                }
              )
            );
          } else {
            _.forEach(allGroups, (id) =>
              bot.telegram.sendMessage(id, caption, {
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    url && buttonLabel ? [{ text: buttonLabel, url }] : [],
                  ],
                },
              })
            );
          }
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
              console.log("Telegram bot started successfully");
              console.log("Bot info:", bot.botInfo);
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
