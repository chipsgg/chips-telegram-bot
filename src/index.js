require("dotenv").config();
const express = require("express");
const path = require("path");
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

app.get("/", (_req, res) => {
  const readmeContent = fs.readFileSync("README.md", "utf-8");
  const renderedContent = md.render(readmeContent);
  res.render("index", {
    title: "Chips.gg Bot",
    content: renderedContent,
  });
});

app.get("/commands", (_req, res) => {
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
    console.error("SDK not initialized!");
    return;
  }

  const commands = Commands(api);
  const connectors = [];

  // API endpoint for executing commands
  app.get("/api/command/:name", async (req, res) => {
    const { name } = req.params;
    // const { username } = req.query;

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

  const port = process.env.PORT || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Web server and bot running on port ${port}`);
  });

  // START THE BOTS

  if (process.env.TELEGRAM_TOKEN) {
    console.log(
      "Initializing Telegram bot with token length:",
      process.env.TELEGRAM_TOKEN?.length
    );
    const telegram = await Telegram(process.env.TELEGRAM_TOKEN, commands);
    if (telegram) {
      connectors.push(telegram);
    }
  } else {
    console.log("No Telegram token provided");
  }

  if (process.env.DISCORD_TOKEN) {
    try {
      const discord = await Discord(process.env.DISCORD_TOKEN, commands);
      if (discord) {
        connectors.push(discord);
      }
    } catch (error) {
      console.error("Error starting Discord bot:", {
        name: error.name,
        message: error.message,
      });
    }
  }

  const _broadcastText = makeBroadcast(connectors, "broadcastText");
  const _broadcastForm = makeBroadcast(connectors, "broadcastForm");
})();
