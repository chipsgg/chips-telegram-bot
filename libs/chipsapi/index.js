const WS = require('ws');
const Client = require('@chipsgg/ws-client');
const _ = require('lodash')

module.exports = () => {
  let api = null
  let state = {}
  return {
    async init() {
      api = await Client(WS, [
        'games',
        'public',
        'private',
        'auth',
        'affiliates',
        'stats',
        'profitshare'
      ], (type, newState) => {
        switch (type) {
          case "change": {
            state = {
              ...state,
              ...newState
            }
            break;
          }
        }
      })

      const subscription = async () => {
        await api.actions.stats('on', { game: "bets", type: "recentBets" })
        await api.actions.stats('on', { game: "bets", type: "luckiest" })
        await api.actions.profitshare('on', { name: "profitshareBalance" })
        await api.actions.profitshare('on', { name: "profitshareInfo" })
        setTimeout(subscription, 60 * 1000)
      }
      await subscription()
    },
    state: () => state,
    get: (...path) => _.get(state, path),
    listRaceRanks: (raceid) => api.actions.public('listRaceRanks', { raceid }),
    listRacePrizes: (raceid) => api.actions.public('listRacePrizes', { raceid }),
    listActiveRaces: (skip = 0, limit = 100) => api.actions.public('listActiveRaces', { skip, limit }),
    listDoneRaces: (skip = 0, limit = 100) => api.actions.public('listDoneRaces', { skip, limit }),
    listSlotCategories: () => api.actions.public('listSlotCategories'),
    listSlotsByCategory: (args) => api.actions.public('listSlotsByCategory', args),
  }
}