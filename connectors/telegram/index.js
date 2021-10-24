const _ = require("lodash");
const marked = require("marked");
const { Telegraf } = require("telegraf");

const telegramMakeForm = ({ emoji, title, content, footer }) => `${_.trim(emoji)} <strong>${_.trim(title)}</strong> ${_.trim(emoji)}
${marked.parseInline(_.trim(content))}${ footer ? `\n\n${marked.parseInline(_.trim(footer))}`:'' }`
const WrapperTelegram = (context) => {
  function sendForm(options){
    const { banner, url, buttonLabel } = options;
    const caption = telegramMakeForm(options);
    if(banner){
      return context.replyWithPhoto({ url: banner }, {
        caption,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            (url && buttonLabel) ? [
              {
                text: buttonLabel,
                url,
              },
            ]:[]
          ],
        }
      }); 
    }else{
      return context.replyWithHTML(caption, {
        reply_markup: {
          inline_keyboard: [
            (url && buttonLabel) ? [
              {
                text: buttonLabel,
                url,
              },
            ]:[]
          ],
        }
      })
    }
  }
  function sendText(content){
    return context.replyWithHTML(marked.parseInline(_.trim(content)));
  }
  return {
    sendForm,
    sendText
  }
}
module.exports = async(token, commands) => {
  const allGroups = []
  const bot = new Telegraf(token);
  _.forEach(_.keys(commands), (commandName) => {
    bot.command(commandName, async(ctx) => {
      const wrapper = WrapperTelegram(ctx);
      await Promise.resolve(commands[commandName].handler(wrapper));
    });
  });
  bot.on('message', (ctx) => {
    const { message } = ctx.update;
    const { chat } = message;
    if(chat.type == "group" && !_.includes(allGroups, chat.id)) {
      allGroups.push(chat.id);
    }
  })
  function broadcastText(message){
    _.forEach(allGroups, (groupId) => bot.telegram.sendMessage(groupId, marked.parseInline(message), {
      parse_mode: "HTML"
    }));
  }
  function broadcastForm(options){
    const { banner, url, buttonLabel } = options;
    const caption = telegramMakeForm(options);
    if(banner){
      _.forEach(allGroups, (groupId) => bot.telegram.sendPhoto(groupId,{ url: banner }, {
        caption,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            (url && buttonLabel) ? [
              {
                text: buttonLabel,
                url,
              },
            ]:[]
          ],
        }
      }));
    }else{
      _.forEach(allGroups, (groupId) => bot.telegram.sendMessage(groupId, caption, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            (url && buttonLabel) ? [
              {
                text: buttonLabel,
                url,
              },
            ]:[]
          ],
        }
      }));
    }
  }
  await bot.launch({
    dropPendingUpdates: true
  });
  return {
    broadcastText,
    broadcastForm
  }
};