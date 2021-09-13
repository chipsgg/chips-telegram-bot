const WS = require('ws');
const Client = require('@chipsgg/openservice-ws-client');
const _ = require('lodash')

module.exports = (isbeta) => {
  if (isbeta) host = 'wss://staging.chips.gg';
  else host = 'wss://api.chips.gg/prod/socket';
  wsclient = null
  state = {}
  return {
    async init() {
      wsclient = await Client(WS, {
        channels: [
          'games',
          'public',
          'private',
          'auth',
          'affiliates',
          'stats',
          'profitshare',
        ], host
      }, (type, newState) => {
        if (type === "change") {
          state = {
            ...state,
            ...newState
          }
        }
      })
      await wsclient.actions.profitshare('on', { name: "profitshare" })
      await wsclient.actions.profitshare('on', { name: "profitshareInfo" })
    },
    state: () => state,
    get: (...path) => _.get(state, path),
    listRaceRanks: (raceid) => wsclient.actions.public('listRaceRanks', { raceid }),
    listActiveRaces: (skip = 0, limit = 10) => wsclient.actions.public('listActiveRaces', { skip, limit })
  }
}