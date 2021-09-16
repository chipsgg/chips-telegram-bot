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
        'profitshare',
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
      await api.actions.profitshare('on', { name: "profitshareBalance" })
      await api.actions.profitshare('on', { name: "profitshareInfo" })
    },
    state: () => state,
    get: (...path) => _.get(state, path),
    listRaceRanks: (raceid) => api.actions.public('listRaceRanks', { raceid }),
    listActiveRaces: (skip = 0, limit = 10) => api.actions.public('listActiveRaces', { skip, limit })
  }
}