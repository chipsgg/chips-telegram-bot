
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
- `/auth` - Link your Telegram/Discord ID to your Chips.gg account

## Authentication

To link your Telegram or Discord account with your Chips.gg account:

1. Enable 2FA/TOTP on your Chips.gg account if you haven't already
2. Use the command: `/auth username:YOUR_USERNAME totp:YOUR_CODE`
   - Replace YOUR_USERNAME with your Chips.gg username
   - Replace YOUR_CODE with your current TOTP code
3. Upon successful authentication, your platform ID will be linked to your account

## Try the Bot

- Discord: [Add to Discord Server](https://discord.com/oauth2/authorize?client_id=901908108136308757&permissions=0&scope=bot%20applications.commands)
- Telegram: [@chipsgg_dev_bot](http://t.me/chipsgg_dev_bot)

## HTTP API Endpoints

The bot provides a RESTful API interface with the following endpoints:

### Endpoints

#### 1. `GET /`
Home page displaying this documentation.

#### 2. `GET /commands` 
List all available bot commands and their descriptions.

#### 3. `GET /api/command/:name`
Execute a bot command through HTTP.

**Parameters:**
- `name` (path parameter) - The command name to execute
- `username` (query parameter) - Required for user-specific commands

**Example Responses:**

For `/api/command/prices`:
```json
{
  "emoji": "💰",
  "title": "Cryptocurrency Prices",
  "content": "BTC: $50,000\nETH: $3,000\nTRX: $0.08",
  "buttonLabel": "Trade Now",
  "url": "https://chips.gg/exchange"
}
```

For `/api/command/user?username=chips`:
```json
{
  "emoji": "👤",
  "title": "User Info: chips",
  "content": "Username: chips\nLevel: Diamond (50)\nTotal Bets: 1,000\nTotal Wins: 500",
  "buttonLabel": "View Profile",
  "url": "https://chips.gg/user/chips"
}
```

### Example Usage

Using cURL:
```bash
# Get cryptocurrency prices
curl http://0.0.0.0:3000/api/command/prices

# Look up user information
curl http://0.0.0.0:3000/api/command/user?username=chips

# Get most played games
curl http://0.0.0.0:3000/api/command/mostplayed
```

Using JavaScript Fetch:
```javascript
// Get random slot recommendation
fetch('http://0.0.0.0:3000/api/command/slotcall')
  .then(response => response.json())
  .then(data => console.log(data));

// Look up user
fetch('http://0.0.0.0:3000/api/command/user?username=chips')
  .then(response => response.json())
  .then(data => console.log(data));
```

The server runs on port 3000 by default (configurable via HTTP_PORT environment variable).

## Support

For support, join our communities:
- Discord: https://discord.gg/chips
- Telegram: https://t.me/chipsggam: https://t.me/chipsgg
