const WS = require('ws');
const Client = require('@chipsgg/ws-api-client');
const _ = require('lodash')

module.exports = (isbeta) => {
  if (isbeta) host = 'wss://staging.chips.gg';
  else host = 'wss://api.chips.gg/prod/socket';
  wsclient = null
  state = {}
  return {
    async init() {
      wsclient = await Client(WS, { channels: ['public'], host }, (type, newState) => {
        if(type === "change"){
          state = {
            ...state, 
            ...newState
          }
        }
      })
    },
    get: (...path) =>_.get(state, ['public', ...path]),
    listRaceRanks: (raceid) => wsclient.actions.public('listRaceRanks', { raceid }),
    listActiveRaces: (skip=0, limit=10) => wsclient.actions.public('listActiveRaces', { skip, limit })
  }
}