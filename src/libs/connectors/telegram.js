const assert = require("assert");
const _ = require("lodash");
const marked = require("marked");
const { Telegraf } = require("telegraf");

const parseAndClean = (content) =>
  _.replace(marked.parseInline(_.trim(content)), "<br>", "\n");

const telegramMakeForm = ({ emoji, title, content, footer }) => `${_.trim(
  emoji,
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
        },
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

    return cmd ? cmd : text.split(" ")[1];
  };

  return {
    platform: "telegram",
    userid: context.update.message.from.id,
    sendForm,
    sendText,
    getArg,
    getString,
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
        await botInstance.stop();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
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
        const { chat, text } = message;
        assert(message, "requires message");
        assert(chat, "requires chat");

        if (chat.type == "group" || chat.type == "supergroup") {
          addGroup(chat.id);
        }

        const wrapper = WrapperTelegram(ctx);

        // if (commandName === 'user') {
        //   const username = text.split(' ')[1];
        //   wrapper.options = {
        //     getString: (param) => param === 'username' ? username : null
        //   };
        // }

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
        }),
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
            },
          ),
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
          }),
        );
      }
    }

    // Enable graceful stop
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));

    bot
      .launch({
        dropPendingUpdates: true,
        allowedUpdates: ["message", "callback_query"],
      })
      .then(() => {
        console.log("Telegram bot started successfully");
        resolve({
          broadcastText,
          broadcastForm,
          cleanup: () => bot.stop(),
        });
      })
      .catch(async (error) => {
        console.error("Failed to start Telegram bot:", error);
        
        if (error.response?.error_code === 409 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(`Retrying bot connection in ${RECONNECT_DELAY/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
          await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
          return startBot();
        }
        
        reject(error);
      });
  };

  return startBot();
});
};
