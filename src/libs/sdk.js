const WS = require("ws");
const Client = require("@chipsgg/openservice-ws-client");
const lodash = require("lodash");
// const assert = require("assert");

module.exports = async (CHIPS_TOKEN) => {
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

  // if current token fails, fallback to a new token assigned to us
  async function Authenticate(actions, tokenid) {
    if (!tokenid) {
      return Authenticate(actions, await actions.auth("token"));
    }
    return actions
      .auth("authenticate", tokenid)
      .then((userid) => {
        return { userid, tokenid };
      })
      .catch((err) => {
        return Authenticate(actions);
      });
  }

  const { actions } = await Client(
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
          console.log("Server Reconnected!");
          // updateState("setConnected", true);
          await Authenticate(actions, CHIPS_TOKEN).then((result) => {
            console.log("authenticated", result);
          });
          break;
        }
      }
    }
  );

  const { userid, tokenid } = await Authenticate(actions, CHIPS_TOKEN);

  // authenticated mode
  if (userid) {
    const user = await actions.private("me");
    console.log('Authenticated as:', user)

    actions.community("publishChatMessage", {
      text: `Hello, I am ${user.username}!`,
      // roomid
    });
  }

  // actions.community('replyToChatMessage', {
  //   text: 'Hello World!',
  //   messageid
  // })

  // actions.community('editChatMessage', {
  //   text: 'Hello World!',
  //   messageid
  // })

  // actions.community('removeChatMessage', {
  //   messageid
  // })

  // shorthand
  const listRaceRanks = (raceid) => actions.public("listRaceRanks", { raceid });
  const listRacePrizes = (raceid) =>
    actions.public("listRacePrizes", { raceid });
  const listActiveRaces = (skip = 0, limit = 100) =>
    actions.public("listActiveRaces", { skip, limit });
  const listDoneRaces = (skip = 0, limit = 100) =>
    actions.public("listDoneRaces", { skip, limit });
  const listSlotCategories = () => actions.public("listSlotCategories");
  const listSlotsByCategory = (args) =>
    actions.public("listSlotsByCategory", args);

  async function getRandomSlot() {
    const slots = await actions.public("listGamesMostPlayed", {
      skip: 0,
      limit: 100,
    });
    return lodash.sample(slots);
  }

  // subscriptions
  setInterval(() => {
    actions.profitshare("on", { name: "profitshareInfo" });
    actions.profitshare("on", { name: "profitshareBalance" });
    actions.stats("on", { game: "bets", type: "recentBets" });
    actions.stats("on", { game: "bets", type: "luckiest" });
    actions.stats("on", { game: "bets", type: "bigwins" });
  }, 1000);

  return {
    state: () => state,
    get: (...path) => lodash.get(state, path),
    getRandomSlot,
    listRaceRanks,
    listRacePrizes,
    listActiveRaces,
    listDoneRaces,
    listSlotCategories,
    listSlotsByCategory,
  };
};
