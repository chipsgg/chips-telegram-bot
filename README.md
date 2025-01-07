
# Chips.gg Chat Bot 🎮

A powerful Discord and Telegram bot for the Chips.gg gaming platform that brings real-time gaming information directly to your community.

## Installation
- Telegram: [ADD BOT](http://t.me/chipsgg_dev_bot) 
- Discord: [ADD BOT](https://discord.com/oauth2/authorize?client_id=901908108136308757&permissions=0&scope=bot%20applications.commands)

## ✨ Features

### Real-time Gaming Information
- 🎲 Random slot recommendations with `/slotcall`
- 🎮 Most played games tracking with `/mostplayed`
- 👑 King of the Hill status with `/koth`

### Player Stats & Rankings
- 🏆 Top player rankings with `/bigwins`
- 🍀 Luckiest players list with `/luckiest`
- 👤 Detailed user information via `/user`

### Platform Updates
- 🎉 Live promotions and events with `/promotions`
- 💰 Real-time cryptocurrency prices using `/prices`
- 🏦 Vault statistics tracking with `/vault`
- 🔎 Search game catalog with `/search game_name`

### Community Tools
- 💬 Access community links with `/chat`
- 🔗 Link your account using `/auth`
- ❓ View all commands with `/help`

## 🚀 Getting Started

### Prerequisites
- Node.js
- Discord bot token and/or Telegram bot token
- Chips.gg API token

### Environment Setup
Create a `.env` file with:

```ini
HTTP_PORT=3000          # Web interface port
CHIPS_TOKEN=your_token  # Chips.gg API token
DISCORD_TOKEN=your_token       # Discord bot token
TELEGRAM_TOKEN=your_token      # Telegram bot token
alertInterval=60000            # Alert interval in milliseconds
alertMinimumDollar=1000       # Minimum dollar amount for alerts
alertMinimumMultiplier=100    # Minimum multiplier for alerts
```

### Quick Start
1. Install dependencies:
```bash
npm install
```

2. Start the bot:
```bash
npm start
```

## 🔐 Authentication

Link your platform account:

1. Enable 2FA/TOTP on your Chips.gg account
2. Use: `/auth username:YOUR_USERNAME totp:YOUR_CODE`
3. Wait for confirmation of successful linking

## 🌐 HTTP API

Access bot features via HTTP endpoints:

### Main Endpoints

#### `GET /`
Home page with documentation

#### `GET /commands`
List all bot commands

#### `GET /api/command/:name`
Execute bot commands via HTTP

**Parameters:**
- `name` (path) - Command to execute
- `username` (query) - For user-specific commands

**Example Response:**
```javascript
{
  "emoji": "💰",
  "title": "Cryptocurrency Prices",
  "content": "BTC: $50,000\nETH: $3,000\nTRX: $0.08",
  "buttonLabel": "Trade Now",
  "url": "https://chips.gg/exchange"
}
```

### API Usage Examples

Using cURL:
```bash
curl http://0.0.0.0:3000/api/command/prices
curl http://0.0.0.0:3000/api/command/user?username=chips
```

Using JavaScript:
```javascript
fetch('http://0.0.0.0:3000/api/command/slotcall')
  .then(response => response.json())
  .then(data => console.log(data));
```

## 💬 Support

Join our communities:
- Discord: https://discord.gg/chips
- Telegram: https://t.me/chipsgg
