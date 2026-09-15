# Chips.gg Bot

## Overview
A Chips.gg chat bot for Discord and Telegram platforms with a web landing page featuring live demos and real-time metrics tracking. The bot provides gaming information, cryptocurrency prices, player stats, affiliate data, and Chips.gg platform features.

## Recent Changes
- 2026-06-24: Added a `/stats` button to the landing-page live demo; demo buttons now support a `data-query` attribute (sample args), and `/stats` reads its `username` on the `api` platform so it returns real player data
- 2026-06-24: Redesigned the landing page (index.ejs + styles.css) to the "Crypto Terminal" theme — pure black, #00ff41 monospace, scanlines, marquee ticker, glitch wordmark, terminal-window live demo; `/commands` page shares the same theme
- 2026-06-24: Hardened the live-demo renderer to build DOM nodes (no innerHTML) and validate result URLs (http/https only)
- 2026-02-06: Renamed `/user` to `/stats` and `/stats` to `/banner`
- 2026-02-06: Updated landing page and docs to reflect command renames
- 2026-02-06: Added `/affiliate` command for affiliate campaign stats with date range filtering
- 2026-02-06: Added `linked_accounts` database table for persistent account linking
- 2026-02-06: Updated `/linkaccount` to store linked accounts in the database
- 2026-02-06: Added `listAffiliateCampaigns` helper to SDK
- 2026-02-06: Added footer with REDPKT logo linking to redpkt.com
- 2026-02-06: Fixed default port to 5000

## Project Architecture
- **Runtime:** Node.js with Express web server
- **Database:** PostgreSQL (Replit built-in)
- **View Engine:** EJS templates
- **Bot Platforms:** Discord.js, Telegraf (Telegram)
- **SDK:** Custom WebSocket client connecting to `wss://api.chips.gg/prod/socket`

### Directory Structure
- `src/index.js` - Main entry point, Express server setup, bot initialization
- `src/commands/` - Bot commands (each file exports a command factory)
- `src/libs/sdk.js` - Chips.gg WebSocket SDK (production)
- `src/libs/sdk_dev.js` - SDK development version
- `src/libs/connectors/` - Discord and Telegram bot connectors
- `src/libs/metrics.js` - Database metrics tracking (shared pool)
- `src/libs/linkedAccounts.js` - Linked accounts database helper
- `src/libs/models.js` - Response formatting models
- `src/libs/utils.js` - Utility functions
- `src/views/` - EJS templates (index.ejs, commands.ejs)
- `src/public/` - Static assets (styles.css, images)

### Database Tables
- `bot_metrics` - Tracks command usage, messages sent, platform-specific counts
- `linked_accounts` - Maps platform users (Discord/Telegram) to Chips.gg accounts

### Key Design Decisions
- Bots (Discord/Telegram) only start in development, not in production deployment
- Development and production use SEPARATE PostgreSQL databases
- Auto-initialization creates metrics rows on startup if they don't exist
- Port: Uses `process.env.PORT || 5000`
- The `/vault` command is disabled (renamed to vault.js.disabled)

## User Preferences
- Footer includes "Developed by REDPKT" logo linking to https://redpkt.com
- Clean, informative bot responses with emoji headers
