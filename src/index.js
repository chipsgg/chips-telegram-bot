require("dotenv").config();
const express = require("express");
const path = require("path");
const HttpServer = require("actions-http");
const SDK = require("./libs/sdk");
const { makeBroadcast } = require("./libs/utils");
const { Discord, Telegram } = require("./libs/connectors");
const Commands = require("./libs/commands");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Routes
const fs = require("fs");
const MarkdownIt = require("markdown-it");
const md = new MarkdownIt({
  highlight: function (str, lang) {
    return `<pre class="code-block"><code class="language-${lang}">${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

app.get("/", (req, res) => {
  const readmeContent = fs.readFileSync("README.md", "utf-8");
  const renderedContent = md.render(readmeContent);
  res.render("index", {
    title: "Chips.gg Bot",
    content: renderedContent,
  });
});

app.get("/commands", (req, res) => {
  const commands = Commands({});
  res.render("commands", {
    title: "Available Commands",
    commands: Object.entries(commands).map(([name, cmd]) => ({
      name,
      description: cmd.description,
    })),
  });
});

// Bot setup
(async () => {
  const api = await SDK(process.env.CHIPS_TOKEN);

  if (!api) {
    return res.status(500).json({ error: "Bot not initialized" });
  }

  const commands = Commands(api);
  const connectors = [];

  // API endpoint for executing commands
  app.get("/api/command/:name", async (req, res) => {
    const { name } = req.params;
    const { username } = req.query;

    const command = commands[name];
    if (!command) {
      return res.status(404).json({ error: "Command not found" });
    }

    try {
      const ctx = {
        platform: "api",
        sendForm: (form) => form,
        sendText: (text) => ({ text }),
        // getArg: req.query
        getString: (key) => req.query[key],
      };

      const result = await command.handler(ctx);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.DISCORD_TOKEN) {
    connectors.push(await Discord(process.env.DISCORD_TOKEN, commands));
  }

  if (process.env.TELEGRAM_TOKEN) {
    try {
      const telegram = await Telegram(process.env.TELEGRAM_TOKEN, commands);
      connectors.push(telegram);
    } catch (error) {
      console.error("Error starting Telegram bot:", error);
    }
  }

  const broadcastText = makeBroadcast(connectors, "broadcastText");
  const broadcastForm = makeBroadcast(connectors, "broadcastForm");

  const port = process.env.PORT || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Web server and bot running on port ${port}`);
  });
})();
