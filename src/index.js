require("dotenv").config();
// const _ = require("lodash");
const HttpServer = require("actions-http");
// const Autoevents = require("./libs/autoevents")(API);
const SDK = require("./libs/sdk");
const { makeBroadcast } = require("./libs/utils");
const { Discord, Telegram } = require("./libs/connectors");
const Commands = require("./libs/commands");

// your desired application interface.
const actions = {
  async ping(params) {
    return "pong";
  },
  async echo(params) {
    return params;
  },
};

// start the bot
(async () => {
  const api = await SDK();
  const commands = Commands(api);

  const connectors = [];

  // init discord
  if (process.env.DISCORD_TOKEN) {
    connectors.push(await Discord(process.env.DISCORD_TOKEN, commands));
  }

  // init telegram
  if (process.env.TELEGRAM_TOKEN) {
    connectors.push(await Telegram(process.env.TELEGRAM_TOKEN, commands));
  }

  const broadcastText = makeBroadcast(connectors, "broadcastText");
  const broadcastForm = makeBroadcast(connectors, "broadcastForm");

  // const timer = async () => {
  //   const trigger = _.eq(
  //     _.ceil(_.divide(Date.now(), 1000)) %
  //       _.multiply(60, process.env.alertInterval || 15),
  //     0
  //   );
  //   if (!trigger) {
  //     setTimeout(timer, 100);
  //     return;
  //   }
  //   setTimeout(timer, 1100);
  //   const { bigwins, luckiest } = Autoevents.poll();
  //   if (bigwins) {
  //     const currency = _.get(bigwins, "bet.currency");
  //     const gamecode = _.get(bigwins, "bet.gamecode");
  //     const currencyInfo = API.get("public", "currencies", currency);
  //     const slot = _.find(API.getSlots(), (s) =>
  //       _.eq(_.get(s, "game_code"), gamecode)
  //     );
  //     if (!slot) return;
  //     if (!slot.url_thumb) return;
  //     broadcastForm(
  //       models.autoevents.bigwin({
  //         ...bigwins.bet,
  //         currencyInfo,
  //         banner: slot.url_thumb,
  //         url: `https://chips.gg/casino/${gamecode}`,
  //       })
  //     );
  //   } else if (luckiest) {
  //     const currency = _.get(luckiest, "bet.currency");
  //     const gamecode = _.get(luckiest, "bet.gamecode");
  //     const currencyInfo = API.get("public", "currencies", currency);
  //     const slot = _.find(API.getSlots(), (s) =>
  //       _.eq(_.get(s, "game_code"), gamecode)
  //     );
  //     if (!slot) return;
  //     if (!slot.url_thumb) return;
  //     broadcastForm(
  //       models.autoevents.luckiest({
  //         ...luckiest.bet,
  //         currencyInfo,
  //         banner: slot.url_thumb,
  //         url: `https://chips.gg/casino/${gamecode}`,
  //       })
  //     );
  //   }
  // };

  // setImmediate(timer);

  // await HttpServer(
  //   {
  //     port: process.env.PORT || 3000,
  //   },
  //   actions
  // );

  console.log("The bot Chips is successfully loaded");
  broadcastText("**The bot Chips is successfully loaded. /help**");
})();
