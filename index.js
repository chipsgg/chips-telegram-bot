require("dotenv").config();
const _ = require('lodash')
const { Telegraf } = require('telegraf')
const models = require('./models')
const config = require('./config')
const API = require('./libs/chipsapi')(isbeta = false)

API.init()
  .then(() => {
    const bot = new Telegraf(process.env.apikey)
    bot.command('divs', ctx => {
      const distributeAt = API.get('profitshare', 'profitshareInfo', 'distributeAt')
      const totalMinted = API.get('profitshare', 'profitshareInfo', 'totalMinted') / 1000000
      const totalStaked = API.get('profitshare', 'profitshareInfo', 'totalStaked') / 1000000

      const pairs = _.keys(API.get('public', 'prices'))

      const currencies = _.chain(API.get('public', 'currencies'))
        .filter(x => !x.hidden && x.name !== 'chips' && x.name !== "chips_staking")
        .map(x => ({
          name: _.upperCase(x.name),
          value: (API.get('profitshare', 'profitshare', x.name) / Math.pow(10, x.decimals)) || 0,
          rate: (API.get('public', 'prices', _.find(pairs, (item) => _.startsWith(item, _.upperCase(x.name))))) || 1
        }))
        .value();

      const totalValue = _.chain(currencies)
        .filter(x => x.value > 0.0)
        .sumBy(x => x.value * x.rate)
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
      const prices = API.get('public', 'prices')
      const currencies = API.get('public', 'currencies')
      // preprocessing
      const pairs = _.reduce(_.keys(prices), (output, current) => {
        if (current.endsWith("USDT")) {
          const pair1 = _.first(current.split('USDT', 1))
          output.push({
            pair1,
            pair2: 'USDT',
            price: prices[current]
          })
        } else if (current.endsWith("BUSD")) {
          const pair1 = _.first(current.split('BUSD', 1))
          output.push({
            pair1,
            pair2: 'BUSD',
            price: prices[current]
          })
        } else if (current.endsWith("USD")) {
          const pair1 = _.first(current.split('USD', 1))
          output.push({
            pair1,
            pair2: 'USD',
            price: prices[current]
          })
        }
        return output
      }, [])
    // TODO: VERIFY
      const pairsFiltered = _.filter(pairs, (item) => currencies.hasOwnProperty(_.toLower(item.pair1)))

      bot.telegram.sendMessage(ctx.chat.id, models.prices(pairsFiltered), { parse_mode: "HTML" })
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