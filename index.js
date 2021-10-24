require("dotenv").config();
const _ = require('lodash');
const { Telegraf } = require('telegraf');
const TelegrafQuestion = require('telegraf-question').default;
const models = require('./models');
const config = require('./config');
const API = require('./libs/chipsapi')();
const Timer = require('./libs/timer')({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: {
    rejectUnauthorized: false
  }
});
const Autoevents = require('./libs/autoevents')(API);
const HttpServer = require("actions-http");
const AutodeleteMiddleware = require('./libs/autodelete');
const AdminMiddleware = require('./libs/admin')(config.superAdmins);
// your desired application interface.
const actions = {
  async ping(params) {
    return "pong";
  },
  async echo(params) {
    return params;
  },
};

// start the bot

API.init()
  .then(async () => {
    const bot = new Telegraf(process.env.apikey);
    bot.use(AdminMiddleware);
    bot.use(TelegrafQuestion({
      cancelTimeout: 300000 // 5 min
    }));
    bot.use(AutodeleteMiddleware);

    const commands = require('./commands')({
      API,
      models,
      modules: {
        Timer,
        Autoevents
      }
    });
    _.forEach(_.keys(commands), (name) => {
      bot.command(name, _.get(commands, name).handler);
    });
    bot.start((ctx) => ctx.replyWithHTML(models.help(commands, ctx.from._is_in_admin_list)));
    bot.help((ctx) => ctx.replyWithHTML(models.help(commands, ctx.from._is_in_admin_list)));
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    bot.on('text', ctx => Timer.incLines());
    bot.launch({
      dropPendingUpdates: true
    });
    // background tasks
    setInterval(async () => {
      const { bigwins, luckiest } = Autoevents.poll();
      if (bigwins.length > 0) {
        const fetched = _.first(bigwins);
        if (!fetched.bet.slotname) return;
        const currencyInfo = API.get('public', 'currencies', fetched.bet.currency);
        const slot = _.find(API.getSlots(), (slot) => slot.game_code == fetched.bet.gamecode);
        await bot.telegram.sendPhoto(config.mainGroup, { url: slot.url_thumb }, {
          caption: models.autoevents.bigwin({ ...fetched.bet, currencyInfo }),
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎩 PLAY NOW 🎩",
                  url: `https://chips.gg/casino/${fetched.bet.gamecode}`,
                },
              ]
            ],
          }
        });
      } else if (luckiest.length > 0) {
        const fetched = _.first(luckiest);
        if (!fetched.bet.slotname) return;
        if (fetched.bet.multiplier < 100) return;
        const currencyInfo = API.get('public', 'currencies', fetched.bet.currency);
        const slot = _.find(API.getSlots(), (slot) => slot.game_code == fetched.bet.gamecode);
        await bot.telegram.sendPhoto(config.mainGroup, { url: slot.url_thumb }, {
          caption: models.autoevents.luckiest({ ...fetched.bet, currencyInfo }),
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎩 PLAY NOW 🎩",
                  url: `https://chips.gg/casino/${fetched.bet.gamecode}`,
                },
              ]
            ],
          }
        });
      }
    }, 15 * 60 * 1000); // every 15 min
    setInterval(async () => {
      const timer = await Timer.poll()
      if (timer) {
        await bot.telegram.sendMessage(config.mainGroup, timer.message.text, { entities: timer.message.entities })
      }
    }, 60 * 1000);
    await HttpServer(
      {
        port: process.env.PORT || 3000
      },
      actions
    );
  })
  .then(() => console.log('The bot Chips is successfully loaded'))
  .catch(console.error);