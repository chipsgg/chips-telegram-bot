/**
 * Main entry point for the Chips.gg Bot application.
 * Sets up the Express web server, initializes the Chips.gg SDK,
 * loads bot commands, and starts Discord and Telegram connectors.
 */

require("dotenv").config();
const express = require("express");
const path = require("path");
const SDK = require("./libs/sdk");
const { makeBroadcast } = require("./libs/utils");
const { Discord, Telegram } = require("./libs/connectors");
const Commands = require("./libs/commands");
const { getMetrics, trackCommand, trackMessage } = require("./libs/metrics");

// Initialize Express application
const app = express();

// Configure view engine to use EJS templates
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Route: Home page displaying bot metrics
app.get("/", async (_req, res) => {
  res.set("Cache-Control", "no-cache");
  const metrics = await getMetrics();
  res.render("index", {
    title: "Chips.gg Bot",
    metrics,
  });
});

// Route: API endpoint for retrieving metrics in JSON format
app.get("/api/metrics", async (_req, res) => {
  res.set("Cache-Control", "no-cache");
  const metrics = await getMetrics();
  res.json(metrics);
});

// Route: Commands page displaying all available bot commands
app.get("/commands", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  const commands = Commands({});
  res.render("commands", {
    title: "Available Commands",
    commands: Object.entries(commands).map(([name, cmd]) => ({
      name,
      description: cmd.description,
    })),
  });
});

// Initialize SDK and start bot connectors
(async () => {
  // Initialize Chips.gg SDK with authentication token
  const api = await SDK(process.env.CHIPS_TOKEN);

  if (!api) {
    console.error("SDK not initialized!");
    return;
  }

  // Load all available bot commands with API context
  const commands = Commands(api);
  const connectors = [];

  // Route: API endpoint for executing bot commands via HTTP
  app.get("/api/command/:name", async (req, res) => {
    const { name } = req.params;
    const command = commands[name];
    if (!command) {
      return res.status(404).json({ error: "Command not found" });
    }

    try {
      const ctx = {
        platform: "api",
        sendForm: (form) => form,
        sendText: (text) => ({ text }),
        getString: (key) => req.query[key],
        getArg: () => null,
      };

      const result = await command.handler(ctx);
      await trackCommand("api");
      await trackMessage();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start Express web server
  const port = process.env.PORT || 5000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Web server and bot running on port ${port}`);
  });

  // Initialize Telegram bot connector if token is provided
  if (process.env.TELEGRAM_TOKEN) {
    console.log(
      "Initializing Telegram bot with token length:",
      process.env.TELEGRAM_TOKEN?.length,
    );
    const telegram = await Telegram(process.env.TELEGRAM_TOKEN, commands);
    if (telegram) {
      connectors.push(telegram);
    }
  } else {
    console.log("No Telegram token provided");
  }

  // Initialize Discord bot connector if token is provided
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

  // Create broadcast helper functions for sending messages to all connectors
  const _broadcastText = makeBroadcast(connectors, "broadcastText");
  const _broadcastForm = makeBroadcast(connectors, "broadcastForm");
})();
