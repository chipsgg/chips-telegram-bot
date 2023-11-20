const WS = require("ws");
const Client = require("@chipsgg/openservice-ws-client");
const lodash = require("lodash");
// const assert = require("assert");
const { sleep } = require("./utils");

module.exports = async (CHIPS_TOKEN, emit = (x) => x) => {
  let state = {};

  const channels = [
    "games",
    "public",
    "private",
    "auth",
    "affiliates",
    "stats",
    "profitshare",
    "community",
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
          emit("change", state);
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

  // pick a random slot and send it to chat.
  const sendRngSlotChat = async (rngGame) => {
    const msg = await actions.community("publishChatMessage", {
      type: "game",
      text: `Random Slot Pick:`,
      // image: rngGame.images.s2,
      data: rngGame,
      // roomid
      id: rngGame.id,
    });

    await sleep(250);

    await actions.community("addChatMessageReaction", {
      messageid: msg.id,
      assetid: "chart_with_downwards_trend",
    });

    await sleep(250);

    await actions.community("addChatMessageReaction", {
      messageid: msg.id,
      assetid: "chart_with_upwards_trend",
    });
  };

  // NOTE: Login Client SDK
  const { userid, tokenid } = await Authenticate(actions, CHIPS_TOKEN);

  console.log("sdk:auth", {
    tokenid,
    userid,
  });

  // authenticated mode
  if (userid) {
    const user = await actions.private("me");
    console.log("Authenticated as:", user);

    // actions.community("publishChatMessage", {
    //   text: `Hello, I am ${user.username}!`,
    //   // roomid
    // });

    // pickRandomForChat();

    const tick = async () => {
      const rngGame = await getRandomSlot();
      console.log("rng.game", rngGame.id);

      try {
        // make koth
        await actions.private("createChallenge", {
          catalogid: rngGame.id,
          multiplier: 10,
          // currency: "usdt",
          // amount: "100000000",
          currency: "trx",
          amount: "1000000000",
          duration: 1000 * 60 * 15, // 15min.
        });

        // notify chat
        await sendRngSlotChat(rngGame);
      } catch (e) {
        // wait...
        console.error("ERROR:", e);
      }

      await sleep(1000 * 60 * 45);
      tick();
    };

    tick();
  }

  // subscriptions
  setInterval(() => {
    actions.profitshare("on", { name: "profitshareInfo" });
    actions.profitshare("on", { name: "profitshareBalance" });
    actions.stats("on", { game: "bets", type: "recentBets" });
    actions.stats("on", { game: "bets", type: "luckiest" });
    actions.stats("on", { game: "bets", type: "bigwins" });
    actions.community("on", { name: "chats", path: ["public"] });
  }, 1000);

  return {
    _actions: actions,
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
