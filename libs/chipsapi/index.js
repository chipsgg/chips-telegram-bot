const WS = require('ws');
const Client = require('@chipsgg/ws-client');
const _ = require('lodash');

module.exports = () => {
  let api = null;
  let state = {};
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
      ], async(type, newState) => {
        switch (type) {
          case "change": {
            state = {
              ...state,
              ...newState
            }
            if(!_.get(newState, 'stats.bets.recentBets')){
              await api.actions.stats('on', { game: "bets", type: "recentBets" });
            }
            if(!_.get(newState, 'stats.bets.luckiest')){
              await api.actions.stats('on', { game: "bets", type: "luckiest" });
            }
            if(!_.get(newState, 'stats.bets.bigwins')){
              await api.actions.stats('on', { game: "bets", type: "bigwins" });
            }
            if(!_.get(newState, 'profitshare.profitshareBalance')){
              await api.actions.profitshare('on', { name: "profitshareBalance" });
            }
            if(!_.get(newState, 'profitshare.profitshareInfo')){
              await api.actions.profitshare('on', { name: "profitshareInfo" });
            }
            break;
          }
          case 'open': {
            console.log('Server Connected!');
            break;
          }
          case 'close': {
            console.log('Server Disconnected!');
            break;
          }
          case 'reconnect': {
            console.log('Server Reconnect!');
            break;
          }
        }
      })

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