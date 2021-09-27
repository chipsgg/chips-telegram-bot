require("dotenv").config();
const _ = require('lodash');
const { Telegraf } = require('telegraf');
const TelegrafQuestion = require('telegraf-question').default
const { fillMarkdownEntitiesMarkup } = require('@rundik/telegram-text-entities-filler');
const models = require('./models');
const config = require('./config');
const API = require('./libs/chipsapi')();
const Timer = require('./libs/timer')(process.env.REDIS_URL)
const HttpServer = require("actions-http");
const AutodeleteMiddleware = require('./libs/autodelete')
const AdminMiddleware = require('./libs/admin')(config.superAdmins)
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

(async () => {
  await API.init()
  const slots = []
  const slotsCategories = await API.listSlotCategories();
  for (let i = 0; i < slotsCategories.length; i++) {
    console.log(`loading ${slotsCategories[i]}`)
    let page = 0
    while (true) {
      const result = await API.listSlotsByCategory({ category: slotsCategories[i], skip: 1000 * page, limit: 1000 })
      if (result && result.length > 0) {
        slots.push(...result)
        page += 1
      } else {
        break;
      }
    }
  }
  const bot = new Telegraf(process.env.apikey)
   // for real time update
  const refreshs = {
    last_divs: null,
    last_prices: null
  }
  bot.use(AdminMiddleware)
  bot.use(TelegrafQuestion({
    cancelTimeout: 300000 // 5 min
  }));
  bot.use(AutodeleteMiddleware)
  bot.command('divs', ctx => {
    const message_config = {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💰 GO TO VAULT 💰",
              url: `https://chips.gg/vault`,
            },
          ]
        ],
      }
    }
    const doWork = () => {
      const distributeAt = API.get('profitshare', 'profitshareInfo', 'distributeAt')
      const totalMinted = API.get('profitshare', 'profitshareInfo', 'totalMinted') / 1000000
      const totalStaked = API.get('profitshare', 'profitshareInfo', 'totalStaked') / 1000000
      const currencies = _.chain(API.get('public', 'currencies'))
        .filter(x => !x.hidden && x.name !== 'chips' && x.name !== "chips_staking")
        .map(x => ({
          name: _.upperCase(x.name),
          value: (API.get('profitshare', 'profitshareBalance', x.name) / Math.pow(10, x.decimals)) || 0,
          price: x.price || 1
        }))
        .value();
      const totalValue = _.chain(currencies)
        .filter(x => x.value > 0.0)
        .sumBy(x => x.value * x.price)
        .value();
      const perThousand = ((totalValue / 4) / totalStaked) * 1000
      return { currencies, distributeAt, totalMinted, totalStaked, totalValue, perThousand }
    }

    let lastContent = models.divs(doWork())
    ctx.reply(lastContent, message_config)
      .then(newCtx => {
        if (refreshs.last_divs) {
          clearInterval(refreshs.last_divs)
        }
        refreshs.last_divs = setInterval(() => {
          const content = models.divs(doWork())
          if (content !== lastContent) {
            try {
              ctx.telegram.editMessageText(newCtx.chat.id, newCtx.message_id, undefined, content, message_config)
              lastContent = content
            } catch (e) {
              clearInterval(refreshs.last_divs)
            }
          }
        }, 3000)
      })
  })
  bot.command('top', async ctx => {
    const activeRaces = await API.listActiveRaces(skip = 0, limit = 10)
    const racesRanks = await Promise.all(_.map(activeRaces, (race) => new Promise((resolve, reject) => {
      API.listRaceRanks(race.id)
        .then(ranks => resolve({ ...race, ranks }))
        .catch(reject)
    })))
    ctx.replyWithHTML(models.top(racesRanks))
  })
  bot.command('events', async ctx => {
    const activeRaces = await API.listActiveRaces(skip = 0, limit = 10)
    ctx.replyWithHTML(models.events(activeRaces), {
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✨ GO TO EVENTS ✨",
              url: `https://chips.gg/events`,
            },
          ]
        ],
      }
    })
  })
  bot.command('prices', ctx => {
    const doWork = () => _.chain(API.get('public', 'currencies'))
      .filter(x => !x.hidden && x.name !== 'chips' && x.name !== "chips_staking" && !_.startsWith(x.name, "usd") && !_.endsWith(x.name, "usd"))
      .value();
    let lastContent = models.prices(doWork())
    ctx.replyWithHTML(lastContent)
      .then(newCtx => {
        if (refreshs.last_prices) {
          clearInterval(refreshs.last_prices)
        }
        refreshs.last_prices = setInterval(() => {
          const content = models.prices(doWork())
          if (content !== lastContent) {
            try {
              ctx.telegram.editMessageText(newCtx.chat.id, newCtx.message_id, undefined, content, {
                parse_mode: "HTML"
              })
              lastContent = content
            } catch (e) {
              clearInterval(refreshs.last_prices)
            }
          }
        }, 4000)
      })
  })
  bot.command('groups', ctx => {
    ctx.replyWithHTML(models.groups(config.ambassadors))
  })
  bot.command('slotcall', ctx => {
    const slot = _.sample(slots)
    ctx.replyWithPhoto({
      url: slot.url_thumb
    }, {
      parse_mode: "HTML",
      caption: models.slotcall(slot),
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎰 PLAY NOW 🎰",
              url: `https://chips.gg/casino/${slot.id}`,
            },
          ]
        ],
      }
    })
  })
  bot.command('luckiest', ctx => {
    const luckiest = API.get('stats', 'bets', 'luckiest')
    const top = _.chain(luckiest)
      .keys()
      .map(id => luckiest[id])
      .filter(obj => _.keys(obj.bet).length > 0)
      .orderBy(obj => obj.bet.multiplier)
      .reverse()
      .uniqBy('userid')
      .take(10)
      .map(obj => {
        const currency = API.get('public', 'currencies', obj.bet.currency)
        obj.bet.amountInDollar = (obj.bet.amount / Math.pow(10, currency.decimals)) * currency.price
        obj.bet.winningsInDollar = (obj.bet.winnings / Math.pow(10, currency.decimals)) * currency.price
        return obj
      })
      .value();
    ctx.replyWithHTML(models.luckiest(top))
  })
  bot.command('bigwins', ctx => {
    const bigwins = API.get('stats', 'bets', 'bigwins')
    const top = _.chain(bigwins)
      .keys()
      .map(id => bigwins[id])
      .filter(obj => _.keys(obj.bet).length > 0)
      .orderBy(obj => {
        const currency = API.get('public', 'currencies', obj.bet.currency)
        return obj.bet.winnings / Math.pow(10, currency.decimals)
      })
      .reverse()
      .uniqBy('userid')
      .take(10)
      .map(obj => {
        const currency = API.get('public', 'currencies', obj.bet.currency)
        obj.bet.amountInDollar = (obj.bet.amount / Math.pow(10, currency.decimals)) * currency.price
        obj.bet.winningsInDollar = (obj.bet.winnings / Math.pow(10, currency.decimals)) * currency.price
        return obj
      })
      .value();
    ctx.replyWithHTML(models.bigwins(top))
  })
  bot.command('listTimers', async ctx => {
    if (ctx.chat.type != "private") return
    if (!ctx.from._is_in_admin_list) return

    const timers = await Timer.listTimers()
    ctx.replyWithHTML(models.listTimers(timers))
  })
  bot.command('deleteTimer', async ctx => {
    if (ctx.chat.type != "private") return
    if (!ctx.from._is_in_admin_list) return
    ctx.ask('What\'s timer to delete?')
      .then(async result => {
        const name = result.message.text
        if (!await Timer.getTimer(name)) {
          ctx.replyWithHTML(models.error("Error", "The timer does not exist"))
          return;
        }
        Timer.deleteTimer(name)
          .then(result => {
            ctx.replyWithHTML(models.deleteTimer(name, result))
          })

      })
  })
  bot.command('addTimer', ctx => {
    if (ctx.chat.type != "private") return
    if (!ctx.from._is_in_admin_list) return

    ctx.ask('What is the name of your timer?')
      .then(async result => {
        const name = result.message.text
        if (await Timer.getTimer(name)) {
          ctx.replyWithHTML(models.error("Error", "A timer already exists under the same name"))
          return;
        }
        ctx.ask('What is the response?')
          .then(result => {
            //const response = fillMarkdownEntitiesMarkup(result.message.text, result.message.entities)
            const response = result.message.text
            ctx.ask('What is the interval in minutes ?')
              .then(result => {
                const interval = _.parseInt(result.message.text) || 1
                ctx.ask('What is the minimum number of lines?')
                  .then(result => {
                    const lineMinimum = _.parseInt(result.message.text) || 0
                    Timer.addTimer(name, response, interval, lineMinimum)
                      .then(doc => ctx.replyWithHTML(models.addTimer(doc)))
                      .catch((e) => ctx.replyWithHTML(models.error("Fatal", "An error has occurred")))
                  })
              })
          })
      })
  })
  bot.start((ctx) => ctx.replyWithHTML(models.help(ctx.from._is_in_admin_list)))
  bot.help((ctx) => ctx.replyWithHTML(models.help(ctx.from._is_in_admin_list)))
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
  bot.hears((ctx) => Timer.incLines())
  bot.launch({
    dropPendingUpdates: true
  })

  setInterval(async () => {
    const timer = await Timer.poll()
    if (timer) {
      bot.telegram.sendMessage(config.mainGroup, timer.response, {
        parse_mode: "HTML"
      })
      //console.log('show', timer)
    }
  }, 60*1000)
  return HttpServer(
    {
      port: process.env.PORT || 3000
    },
    actions
  );
})()
  .then(() => console.log('The bot Chips is successfully loaded'))
  .catch(console.error)