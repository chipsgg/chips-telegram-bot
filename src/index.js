
require("dotenv").config();
const express = require('express');
const path = require('path');
const HttpServer = require("actions-http");
const SDK = require("./libs/sdk");
const { makeBroadcast } = require("./libs/utils");
const { Discord, Telegram } = require("./libs/connectors");
const Commands = require("./libs/commands");

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.render('index', { title: 'Chips.gg Bot' });
});

app.get('/commands', (req, res) => {
  const commands = Commands({});
  res.render('commands', { 
    title: 'Available Commands',
    commands: Object.entries(commands).map(([name, cmd]) => ({
      name,
      description: cmd.description
    }))
  });
});

// Bot setup
(async () => {
  const api = await SDK(process.env.CHIPS_TOKEN);
  const commands = Commands(api);
  const connectors = [];

  if (process.env.DISCORD_TOKEN) {
    connectors.push(await Discord(process.env.DISCORD_TOKEN, commands));
  }

  if (process.env.TELEGRAM_TOKEN) {
    connectors.push(await Telegram(process.env.TELEGRAM_TOKEN, commands));
  }

  const broadcastText = makeBroadcast(connectors, "broadcastText");
  const broadcastForm = makeBroadcast(connectors, "broadcastForm");

  app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log("Web server and bot running");
  });
})();
