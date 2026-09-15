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
const { getMetrics, trackCommand, backendKind } = require("./libs/metrics");

const app = express();
app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Liveness/readiness state, exposed at /health and used by the landing page
const status = {
  startedAt: Date.now(),
  sdk: "starting",
  telegram: process.env.TELEGRAM_TOKEN ? "starting" : "disabled",
  discord: process.env.DISCORD_TOKEN ? "starting" : "disabled",
  metrics: backendKind,
};

// Route: Home page displaying bot metrics
app.get("/", async (_req, res) => {
  res.set("Cache-Control", "no-cache");
  const metrics = await getMetrics();
  res.render("index", { title: "Chips.gg Bot", metrics, status });
});

// Route: metrics as JSON
app.get("/api/metrics", async (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json(await getMetrics());
});

// Route: health for load balancers / uptime checks (503 until the SDK is up)
app.get("/health", (_req, res) => {
  const ok = status.sdk === "connected";
  res.status(ok ? 200 : 503).json({
    ok,
    uptimeSec: Math.round((Date.now() - status.startedAt) / 1000),
    ...status,
  });
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

// Commands that only make sense with a Discord/Telegram identity are not exposed over HTTP
const API_HIDDEN = new Set([
  "linkaccount",
  "checkaccount",
  "myaffiliates",
  "affiliate",
]);

// Build the HTTP ctx: query params are the named args; ?args=a+b+c gives positional args
const apiContext = (req) => {
  const positional = String(req.query.args || "")
    .split(/\s+/)
    .filter(Boolean);
  return {
    platform: "api",
    userid: null,
    sendForm: (form) => form,
    sendText: (text) => ({ text }),
    getString: (key) =>
      req.query[key] === undefined ? undefined : String(req.query[key]),
    getNumber: (key) =>
      req.query[key] === undefined ? undefined : Number(req.query[key]),
    getArg: (index) => positional[index - 1],
    getContent: () => positional.join(" "),
  };
};

// Initialize SDK and start bot connectors
(async () => {
  // Start listening immediately so /health answers 503 while the SDK connects
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Web server listening on port ${port}`);
  });

  let api;
  try {
    api = await SDK(process.env.CHIPS_TOKEN);
    status.sdk = "connected";
  } catch (error) {
    status.sdk = `failed: ${error.message}`;
    console.error("SDK not initialized:", error.message);
    return;
  }

  const commands = Commands(api);
  const connectors = [];

  // Route: execute a command over HTTP (used by the landing-page live demo)
  app.get("/api/command/:name", async (req, res) => {
    const { name } = req.params;
    const command = commands[name];
    if (!command || API_HIDDEN.has(name)) {
      return res.status(404).json({ error: "Command not found" });
    }

    try {
      const result = await command.handler(apiContext(req));
      await trackCommand("api");
      res.set("Cache-Control", "no-cache");
      res.json(result);
    } catch (error) {
      console.error(`[api] /${name} failed:`, error.message);
      res.status(500).json({ error: "Command failed" });
    }
  });

  // Initialize Telegram bot connector if token is provided
  if (process.env.TELEGRAM_TOKEN) {
    try {
      const telegram = await Telegram(process.env.TELEGRAM_TOKEN, commands);
      if (telegram) connectors.push(telegram);
      status.telegram = "connected";
    } catch (error) {
      status.telegram = `failed: ${error.message}`;
      console.error("Error starting Telegram bot:", error.message);
    }
  } else {
    console.log("No Telegram token provided");
  }

  // Initialize Discord bot connector if token is provided
  if (process.env.DISCORD_TOKEN) {
    try {
      const discord = await Discord(process.env.DISCORD_TOKEN, commands);
      if (discord) connectors.push(discord);
      status.discord = "connected";
    } catch (error) {
      status.discord = `failed: ${error.message}`;
      console.error("Error starting Discord bot:", error.message);
    }
  } else {
    console.log("No Discord token provided");
  }

  // Broadcast helpers for sending messages to every connected platform
  api.broadcastText = makeBroadcast(connectors, "broadcastText");
  api.broadcastForm = makeBroadcast(connectors, "broadcastForm");
})();
