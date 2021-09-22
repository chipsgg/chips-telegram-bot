require("dotenv").config();
const _ = require('lodash');
const { Telegraf } = require('telegraf');
const models = require('./models');
const config = require('./config');
const API = require('./libs/chipsapi')();
const HttpServer = require("actions-http");

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
  bot.command('divs', ctx => {
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

    bot.telegram.sendMessage(ctx.chat.id, models.divs({ currencies, distributeAt, totalMinted, totalStaked, totalValue, perThousand }), { parse_mode: "HTML" })
  })
  bot.command('top', async ctx => {
    const activeRaces = await API.listActiveRaces(skip = 0, limit = 10)
    const racesRanks = await Promise.all(_.map(activeRaces, (race) => new Promise((resolve, reject) => {
      API.listRaceRanks(race.id)
        .then(ranks => resolve({ ...race, ranks }))
        .catch(reject)
    })))
    bot.telegram.sendMessage(ctx.chat.id, models.top(racesRanks), { parse_mode: "HTML", disable_web_page_preview: true })
  })
  bot.command('events', async ctx => {
    const activeRaces = await API.listActiveRaces(skip = 0, limit = 10)
    bot.telegram.sendMessage(ctx.chat.id, models.events(activeRaces), { parse_mode: "HTML", disable_web_page_preview: true })
  })
  bot.command('prices', ctx => {
    const currencies = _.chain(API.get('public', 'currencies'))
      .filter(x => !x.hidden && x.name !== 'chips' && x.name !== "chips_staking" && !_.startsWith(x.name, "usd") && !_.endsWith(x.name, "usd"))
      .value();
    bot.telegram.sendMessage(ctx.chat.id, models.prices(currencies), { parse_mode: "HTML" })
  })
  bot.command('groups', ctx => {
    bot.telegram.sendMessage(ctx.chat.id, models.groups(config.ambassadors), {})
  })
  bot.command('slotcall', ctx => {
    const slot = _.sample(slots)
    ctx.reply(models.slotcall(slot), {
      parse_mode: "markdown",
      disable_web_page_preview: false,
      "reply_markup": {
        "inline_keyboard": [
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
    ctx.reply(models.luckiest(top), {
      parse_mode: "HTML"
    })
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
    ctx.reply(models.bigwins(top), {
      parse_mode: "HTML"
    })
  })
  bot.help((ctx) => ctx.reply('help'))
  bot.launch()
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
  return HttpServer(
    {
      port: process.env.PORT || 3000
    },
    actions
  );
})()
  .then(() => console.log('The bot Chips is successfully loaded'))
  .catch(console.error)