require("dotenv").config();
var loader = require("./libs/loader");

const { username, apikey } = process.env;

function Run({ username, apikey }) {
  loader.username = username;
  loader.apikey = apikey;

  loader.startTitle = "Welcome to the Chips.gg bot";
  loader.startMessage =
    "This bot is developed by @sintaklaas.\n\nWanna buy me a coffee?\nTRX: <code>TZJDzX9xv5nQ7SymwVcSsWdVtyZYnQnNsh</code>";

  loader.groupWelcome = "";

  loader.startModules(["chips"]);
}

// start the app
Run({
  username,
  apikey,
});
