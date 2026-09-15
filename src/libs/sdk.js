/**
 * Chips.gg WebSocket SDK Client
 * Establishes and manages a persistent WebSocket connection to the Chips.gg API,
 * providing authenticated access to platform services including community chat,
 * game data, affiliates, stats, and profitshare channels.
 */
const WS = require("ws");
const Client = require("@chipsgg/openservice-ws-client");
const lodash = require("lodash");
// const assert = require("assert");
const { sleep } = require("./utils");

module.exports = async (CHIPS_TOKEN, emit = (x) => x) => {
  let state = {};

  // WebSocket channels to subscribe to on the Chips.gg platform
  const channels = [
    "games",
    "public",
    "private",
    "auth",
    "affiliates",
    "stats",
    "profitshare",
    "community",
    "backoffice",
  ];

  // Authenticate with the Chips.gg API; if the provided token fails, request a new one
  async function Authenticate(actions, tokenid) {
    if (!tokenid) {
      return Authenticate(actions, await actions.auth("token"));
    }
    return actions
      .auth("authenticate", tokenid)
      .then((userid) => {
        return { userid, tokenid };
      })
      .catch(() => {
        return Authenticate(actions);
      });
  }

  // Initialize the WebSocket client and handle connection lifecycle events
  const { actions } = await Client(
    WS,
    {
      host: "wss://api.chips.gg/prod/socket",
      channels,
      keepAlive: 1000,
      wsOptions: {
        handshakeTimeout: 10000,
        maxRetries: 5,
        onError: (err) => console.error("WebSocket Error:", err),
      },
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
    },
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

  // Fetch the most played games and return a random slot from the list
  async function getRandomSlot() {
    const slots = await actions.public("listGamesMostPlayed", {
      skip: 0,
      limit: 100,
    });
    return lodash.sample(slots.filter((x) => x.tags.includes("slots")));
  }

  // Publish a random slot pick to the community chat with up/down reaction buttons
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

  // Perform initial authentication with the provided token
  const { userid, tokenid: _tokenid } = await Authenticate(
    actions,
    CHIPS_TOKEN,
  );

  // console.log("sdk:auth", {
  //   tokenid,
  //   userid,
  // });

  // authenticated mode
  if (userid) {
    const user = await actions.private("me");
    console.log("Authenticated SDK:", user.id, user.username);

    // actions.community("publishChatMessage", {
    //   text: `Hello, I am ${user.username}!`,
    //   // roomid
    // });

    // pickRandomForChat();

    const _tick = async () => {
      const rngGame = await getRandomSlot();
      console.log("rng.game", rngGame.id);

      try {
        // make koth
        await actions.private("createKothChallenge", {
          catalogid: rngGame.id,
          multiplier: 10,
          // currency: "usdt",
          // amount: "100000000",
          currency: "trx",
          amount: "100000000",
          duration: 1000 * 60 * 15, // 15min.
        });

        // notify chat
        await sendRngSlotChat(rngGame);

        // wait to post again
        await sleep(1000 * 60 * 60 * 1);
      } catch (e) {
        // wait...
        console.error("ERROR:", e);
      }

      await sleep(1000 * 60 * 30);
      _tick();
    };

    // tick();
  }

  // Periodically re-subscribe to real-time data feeds (profitshare, bets, chat)
  setInterval(() => {
    actions.profitshare("on", { name: "profitshareInfo" });
    actions.profitshare("on", { name: "profitshareBalance" });
    actions.stats("on", { game: "bets", type: "recentBets" });
    actions.stats("on", { game: "bets", type: "luckiest" });
    actions.stats("on", { game: "bets", type: "bigwins" });
    actions.community("on", { name: "chats", path: ["public"] });
  }, 1000);

  // Public API helper methods for races, slots, affiliates, and user lookups
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
  const listAffiliateCampaigns = (userid) =>
    actions.affiliates("listAffiliateCampaigns", { userid });
  const getUserByPlatformID = (platform, platformid) =>
    actions.auth("getUserByPlatformID", { platformid, platform });

  // Exported SDK interface exposing state access and platform query methods
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
    listAffiliateCampaigns,
    getUserByPlatformID,
  };
};
