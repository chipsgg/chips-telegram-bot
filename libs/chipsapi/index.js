const WS = require('ws');
const Client = require('@chipsgg/ws-client');
const _ = require('lodash');

module.exports = () => {
  let api = null;
  let state = {};
  return {
    async init() {
      setInterval(() => {
        api.actions.profitshare('on', { name: "profitshareInfo" });
        api.actions.profitshare('on', { name: "profitshareBalance" });
        api.actions.stats('on', { game: "bets", type: "recentBets" });
        api.actions.stats('on', { game: "bets", type: "luckiest" });
        api.actions.stats('on', { game: "bets", type: "bigwins" });
      }, 1000)
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