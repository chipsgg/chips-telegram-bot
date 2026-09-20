# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Discord + Telegram bot for the Chips.gg gaming platform (`@chipsgg/telegram-bot`),
plus an Express landing page that serves the same commands over HTTP. It
connects to the `chips-framework` backend over WebSocket using
`@chipsgg/openservice-ws-client`. See [README.md](README.md) for the
user-facing command list and HTTP API, and [replit.md](replit.md) for the
Replit deployment target and a running changelog of recent behavior changes.

## Commands

```bash
yarn install
node index.js          # or: yarn start — runs src/index.js
yarn test               # node --test test/
yarn lint                # biome check src test
yarn lint:fix             # biome check --write src test
```

Run a single test file: `node --test test/models.test.js`. Node's built-in
test runner also supports `--test-name-pattern` to filter by test name.

There is no build step — the app runs directly from `src/` via `node`.

## Configuration

`.env` (dotenv, loaded in `src/index.js`) holds `CHIPS_TOKEN`, `TELEGRAM_TOKEN`,
`DISCORD_TOKEN`, `PORT` (defaults to 5000) and the Postgres connection. Discord
and Telegram connectors only start if their token env var is set — either can
be omitted and the bot still serves the HTTP API and landing page.

## Architecture

`src/index.js` is the entry point: it starts an Express server immediately
(so `/health` can answer 503 while the backend connects), then connects to
the Chips.gg backend via `src/libs/sdk.js`, loads commands, and starts
whichever bot connectors have tokens configured.

- **Commands are platform-agnostic.** `src/libs/commands.js` reads every
  `.js` file in `src/commands/` and builds a `{ name → { description,
  options, handler } }` map. Each command file exports a factory
  `(api) => ({ name, description, options, handler(ctx) {...} })` — `api` is
  the connected SDK instance (`src/libs/sdk.js`), fetched once at startup.
  Add a new command by dropping a new file in `src/commands/`; it is picked
  up automatically, no registration step.
- **One handler serves three surfaces.** The same `handler(ctx)` runs for
  Telegram, Discord and the HTTP API (`GET /api/command/:name`). `ctx`
  abstracts the differences: `getString`/`getNumber`/`getArg`/`getContent`
  read arguments, `sendText`/`sendForm` send the response. Telegram and
  Discord context objects live in `src/libs/connectors/`; the HTTP context is
  built inline in `index.js` (`apiContext`). Commands that only make sense
  with a linked platform identity (`linkaccount`, `checkaccount`,
  `myaffiliates`, `affiliate`) are excluded from the HTTP surface via
  `API_HIDDEN` in `index.js`.
- **Response models are shared too.** `src/libs/models.js` and
  `src/libs/models/` format SDK data into the `{ emoji, title, content,
  buttonLabel, url }` shape each connector renders in its own way (Telegram
  message, Discord embed, JSON).
- **Metrics** (`src/libs/metrics.js`) track command usage and message counts
  in Postgres, behind a shared connection pool; `getMetrics`/`trackCommand`
  are called from both the bot connectors and the HTTP routes.
- **Linked accounts** (`src/libs/linkedAccounts.js`) map a Discord/Telegram
  user to a Chips.gg account (via `/auth`, TOTP-based), stored in the
  `linked_accounts` Postgres table.
- `loadCommands` only picks up files ending in `.js`, so a command can be
  disabled without deleting it by renaming it to `<name>.js.disabled`.
