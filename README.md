# Chips.gg community bot

Discord slash commands + Telegram bot for [Chips.gg](https://chips.gg): live prices, big wins,
luckiest bets, KOTH, promotions, slot picks, player stats, account linking, affiliate stats.

- Telegram: [@chipsgg_official_bot](https://t.me/chipsgg_official_bot)
- Discord: [add to a server](https://discord.com/oauth2/authorize?client_id=901908108136308757&permissions=268435456&scope=bot%20applications.commands)
- Landing page, HTTP demo API and health: https://bot.chips.gg

## Layout

Everything lives in [`worker/`](worker/). One codebase, two runtimes:

| runtime | entry | where |
|---|---|---|
| Cloudflare Workers (production) | `worker/src/index.js` | `bot.chips.gg` (prod), `bot-cf.chips.gg` (dev) |
| Node >= 22.5 / Docker | `worker/src/adapters/node.js` | anywhere else, zero runtime deps |

Commands, platform handlers, the realtime feed and metrics are shared; each entrypoint is
~40 lines of wiring. See [`worker/README.md`](worker/README.md) for architecture, environments,
secrets, versioning/releases and the cutover record.

## Quick start

```
cd worker
npm ci
npm test                     # unit tests
npm run dev                  # Cloudflare runtime locally (wrangler dev, :8787)
npm run dev:node             # Node runtime locally, reads ./.env (copy .env.example)
node scripts/smoke.js http://localhost:8787
```

## Commands

`/prices` `/bigwins` `/luckiest` `/koth` `/promotions` `/promotion` `/slotcall` `/mostplayed`
`/search` `/stats` `/compare` `/bet` `/banner` `/chat` `/help` and, on Discord/Telegram only,
`/linkaccount` (TOTP, DM only) `/checkaccount` `/myaffiliates` `/affiliate` (staff).

## HTTP API

Read-only, used by the landing page's live demo. Identity commands are not exposed.

```
GET /api/command/prices
GET /api/command/stats?args=tacyarg
GET /api/command/search?args=sweet+bonanza
GET /commands.json
GET /api/metrics
GET /health                  # feed + Discord/Telegram wiring + last activity; 503 when degraded
```

## Releases

`vX.Y.Z` git tags are releases. `npm run release -- patch|minor|major` from `master` tags and
pushes; GitHub Actions tests, publishes the release notes and deploys production, then verifies
`bot.chips.gg/health` reports the tag. Details in `worker/README.md`.

## Support

- Discord: https://discord.gg/chips
- Telegram: https://t.me/chipsgg
