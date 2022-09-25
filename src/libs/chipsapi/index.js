const WS = require("ws");
const Client = require("@chipsgg/ws-client");
const _ = require("lodash");
const wait = (timeout) =>
  new Promise((resolve, reject) => setTimeout(resolve, timeout));
module.exports = () => {
  let api = null;
  let state = {};
  const slots = [];
  const getSlots = _.constant(slots);
  const getRandomSlot = () => _.sample(getSlots());
  const listRaceRanks = (raceid) =>
    api.actions.public("listRaceRanks", { raceid });
  const listRacePrizes = (raceid) =>
    api.actions.public("listRacePrizes", { raceid });
  const listActiveRaces = (skip = 0, limit = 100) =>
    api.actions.public("listActiveRaces", { skip, limit });
  const listDoneRaces = (skip = 0, limit = 100) =>
    api.actions.public("listDoneRaces", { skip, limit });
  const listSlotCategories = () => api.actions.public("listSlotCategories");
  const listSlotsByCategory = (args) =>
    api.actions.public("listSlotsByCategory", args);
  return {
    async init() {
      setInterval(() => {
        api.actions.profitshare("on", { name: "profitshareInfo" });
        api.actions.profitshare("on", { name: "profitshareBalance" });
        api.actions.stats("on", { game: "bets", type: "recentBets" });
        api.actions.stats("on", { game: "bets", type: "luckiest" });
        api.actions.stats("on", { game: "bets", type: "bigwins" });
      }, 1000);
      api = await Client(
        WS,
        [
          "games",
          "public",
          "private",
          "auth",
          "affiliates",
          "stats",
          "profitshare",
        ],
        async (type, newState) => {
          switch (type) {
            case "change": {
              state = {
                ...state,
                ...newState,
              };
              break;
            }
            case "open": {
              console.log("Server Connected!");
              break;
            }
            case "close": {
              console.log("Server Disconnected!");
              break;
            }
            case "reconnect": {
              console.log("Server Reconnect!");
              break;
            }
          }
        }
      );
      await wait(100);
      const slotsCategories = await listSlotCategories();
      for (let i = 0; i < slotsCategories.length; i++) {
        let page = 0;
        while (true) {
          const result = await listSlotsByCategory({
            category: slotsCategories[i],
            skip: 1000 * page,
            limit: 1000,
          });
          if (result && result.length > 0) {
            slots.push(...result);
            page += 1;
          } else {
            break;
          }
        }
      }
    },
    state: () => state,
    get: (...path) => _.get(state, path),
    getSlots,
    getRandomSlot,
    listRaceRanks,
    listRacePrizes,
    listActiveRaces,
    listDoneRaces,
    listSlotCategories,
    listSlotsByCategory,
  };
};
