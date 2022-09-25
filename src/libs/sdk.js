const WS = require("ws");
const Client = require("@chipsgg/openservice-ws-client");
const lodash = require("lodash");
// const assert = require("assert");

module.exports = async (config) => {
  let state = {};
  
  const channels = [
    "games",
    "public",
    "private",
    "auth",
    "affiliates",
    "stats",
    "profitshare",
  ];

  const api = await Client(
    WS,
    {
      host: "wss://api.chips.gg/prod/socket",
      channels,
      keepAlive: 1000,
    },
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

  // const slots = [];

  // const getSlots = lodash.constant(slots);
  // const getRandomSlot = () => lodash.sample(getSlots());

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

  // const slotsCategories = await listSlotCategories();
  // for (let i = 0; i < slotsCategories.length; i++) {
  //   let page = 0;
  //   while (true) {
  //     const result = await listSlotsByCategory({
  //       category: slotsCategories[i],
  //       skip: 1000 * page,
  //       limit: 1000,
  //     });
  //     if (result && result.length > 0) {
  //       slots.push(...result);
  //       page += 1;
  //     } else {
  //       break;
  //     }
  //   }
  // }

  setInterval(() => {
    api.actions.profitshare("on", { name: "profitshareInfo" });
    api.actions.profitshare("on", { name: "profitshareBalance" });
    api.actions.stats("on", { game: "bets", type: "recentBets" });
    api.actions.stats("on", { game: "bets", type: "luckiest" });
    api.actions.stats("on", { game: "bets", type: "bigwins" });
  }, 1000);

  return {
    state: () => state,
    get: (...path) => lodash.get(state, path),
    // getSlots,
    // getRandomSlot,
    listRaceRanks,
    listRacePrizes,
    listActiveRaces,
    listDoneRaces,
    listSlotCategories,
    listSlotsByCategory,
  };
};
