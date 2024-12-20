
# Chips.gg Chat Bot 🎮

A Discord and Telegram bot for the Chips.gg gaming platform that provides real-time information about games, events, prices, and more.

## Features

- 🎲 Get random slot recommendations
- 💰 Check cryptocurrency prices
- 🎉 View ongoing promotions and events
- 🏆 See top player rankings
- 📊 Track vault statistics
- 👥 Look up user information
- 🎮 View most played games

## Getting Started

### Prerequisites
- Node.js
- A Discord bot token and/or Telegram bot token
- Chips.gg API token

### Environment Variables
Create a `.env` file in your project root with the following:

```env
HTTP_PORT=3000          # Web interface port
CHIPS_TOKEN=your_token  # Chips.gg API token
DISCORD_TOKEN=your_token       # Discord bot token
TELEGRAM_TOKEN=your_token      # Telegram bot token
alertInterval=60000            # Alert interval in milliseconds
alertMinimumDollar=1000       # Minimum dollar amount for alerts
alertMinimumMultiplier=100    # Minimum multiplier for alerts
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the bot:
```bash
npm start
```

## Available Commands

- `/slotcall` - Get a random slot recommendation
- `/prices` - Check cryptocurrency prices
- `/promotions` - View ongoing promotions
- `/vault` - Check vault statistics
- `/bigwins` - See biggest winners
- `/luckiest` - View luckiest players
- `/user [username]` - Look up user information
- `/chat` - Get community links
- `/mostplayed` - List most played games
- `/help` - View all commands

## Try the Bot

- Discord: [Add to Discord Server](https://discord.com/oauth2/authorize?client_id=901908108136308757&permissions=0&scope=bot%20applications.commands)
- Telegram: [@chipsgg_dev_bot](http://t.me/chipsgg_dev_bot)

## HTTP API Endpoints

The bot provides a web interface with the following endpoints:

- `GET /` - Home page with README content
- `GET /commands` - List of all available bot commands and their descriptions

The server runs on port 3000 by default (configurable via HTTP_PORT environment variable).

## Support

For support, join our communities:
- Discord: https://discord.gg/chips
- Telegram: https://t.me/chipsggam: https://t.me/chipsgg
