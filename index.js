require("dotenv").config();
const _ = require('lodash')
const { Telegraf } = require('telegraf')
const models = require('./models')
const config = require('./config')
const API = require('./libs/chipsapi')(isbeta = false)

return API.init()
  .then(() => {
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
    bot.help((ctx) => ctx.reply('help'))
    bot.launch()
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
  })
  .catch(console.error)