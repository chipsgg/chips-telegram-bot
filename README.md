
# Chips.gg Chat Bot 🎮

A powerful Discord and Telegram bot for the Chips.gg gaming platform that brings real-time gaming information directly to your community.

## Installation
- Discord: [ADD BOT](https://discord.com/oauth2/authorize?client_id=901908108136308757&permissions=0&scope=bot%20applications.commands)

## ✨ Features

### Real-time Gaming Information
- 🎲 Random slot recommendations with `/slotcall`
- 🎮 Most played games tracking with `/mostplayed`
- 👑 King of the Hill status with `/koth`

### Player Stats & Rankings
- 🏆 Top player rankings with `/bigwins`
- 🍀 Luckiest players list with `/luckiest`
- 👤 Detailed user information via `/stats`

### Platform Updates
- 🎉 Live promotions and events with `/promotions`
- 💰 Real-time cryptocurrency prices using `/prices`
- 🏦 Vault statistics tracking with `/vault`
- 🔎 Search game catalog with `/game [name]`

### Community Tools
- 💬 Access community links with `/chat`
- 🔗 Link your account using `/link`
- ❓ View all commands with `/help`

## 🚀 Getting Started

### Prerequisites
- Node.js
- Discord bot token and/or Telegram bot token
- Chips.gg API token

### Environment Setup
Create a copy of `.env.example` and rename it to `.env`. Fill in the required values!

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

## 💬 Support

Join our communities:
- Discord: https://discord.gg/chips
- Telegram: https://t.me/chipsgg
