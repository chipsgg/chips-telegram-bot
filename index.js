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
      const distributeAt = API.get('profitShareInfo', 'distributeAt')
      const totalMinted = API.get('profitShareInfo', 'totalMinted')
      const totalStaked = API.get('profitShareInfo', 'totalStaked')
      bot.telegram.sendMessage(ctx.chat.id, models.divs({ distributeAt, totalMinted, totalStaked }), { parse_mode: "HTML" })
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
      if (activeRaces.length > 0) {
        bot.telegram.sendMessage(ctx.chat.id, models.events(activeRaces), { parse_mode: "HTML", disable_web_page_preview: true })
      } else {
        bot.telegram.sendMessage(ctx.chat.id, "There are no races at the moment!", {})
      }
    })
    bot.command('prices', ctx => {
      const prices = API.get('prices')
      const currencies = API.get('currencies')

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