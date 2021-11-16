const assert = require("assert");
const _ = require("lodash");
const marked = require("marked");
const { Telegraf } = require("telegraf");

const telegramMakeForm = ({ emoji, title, content, footer }) => `${_.trim(
  emoji
)} <strong>${_.trim(title)}</strong> ${_.trim(emoji)}
${marked.parseInline(_.trim(content))}${
  footer ? `\n\n${marked.parseInline(_.trim(footer))}` : ""
}`;
const WrapperTelegram = (context) => {
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
              url && buttonLabel
                ? [
                    {
                      text: buttonLabel,
                      url,
                    },
                  ]
                : [],
            ],
          },
        }
      );
    } else {
      return context.replyWithHTML(caption, {
        reply_markup: {
          inline_keyboard: [
            url && buttonLabel
              ? [
                  {
                    text: buttonLabel,
                    url,
                  },
                ]
              : [],
          ],
        },
      });
    }
  }
  function sendText(content) {
    return context.replyWithHTML(marked.parseInline(_.trim(content)));
  }
  return {
    sendForm,
    sendText,
  };
};
module.exports = (token, commands) =>
  new Promise((resolve, reject) => {
    const allGroups = [];
    const addGroup = (id) => {
      if (!_.includes(allGroups, id)) {
        allGroups.push(id);
      }
    };
    const bot = new Telegraf(token);
    _.forEach(_.keys(commands), (commandName) => {
      bot.command(commandName, async (ctx) => {
        const { message } = ctx.update;
        const { chat } = message;
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
        bot.telegram.sendMessage(groupId, marked.parseInline(message), {
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
                  url && buttonLabel
                    ? [
                        {
                          text: buttonLabel,
                          url,
                        },
                      ]
                    : [],
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
                url && buttonLabel
                  ? [
                      {
                        text: buttonLabel,
                        url,
                      },
                    ]
                  : [],
              ],
            },
          })
        );
      }
    }
    bot
      .launch({
        dropPendingUpdates: true,
      })
      .then(() =>
        resolve({
          broadcastText,
          broadcastForm,
        })
      )
      .catch(reject);
  });
