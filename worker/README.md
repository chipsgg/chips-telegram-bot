# Chips.gg bot on Cloudflare Workers

Replaces the long-running Node process (Replit) with a Worker: Discord via the **Interactions
endpoint** (HTTPS, no gateway), Telegram via **webhook** (no polling), Chips API via HTTP RPC,
and one **Durable Object** (`ChipsFeed`) holding the single WebSocket that the API pushes
realtime-only state over (prices, bigwins, luckiest, profitshare).

```
Discord  ─POST /discord──▶ Worker ─┬─▶ api.chips.gg/prod/api/<channel>/<method>  (RPC)
Telegram ─POST /telegram─▶ Worker ─┤
Landing  ─GET  /* ────────▶ Worker ─┴─▶ DO ChipsFeed ──ws──▶ api.chips.gg/prod/socket
metrics  ───────────────────────────▶ D1 chips-bot-metrics
```

## Layout

```
worker/
  src/index.js              router: /discord /telegram /api/command/:name /api/metrics /api/ticker /health /commands.json
  src/commands/index.js     the 19 commands (same form contract as the Node bot)
  src/commands/affiliate.js identity.js
  src/platform/discord.js   Ed25519 verify, defer + PATCH @original, reroll buttons
  src/platform/discord-rest.js  embed builder, role assign, command registration
  src/platform/telegram.js  webhook, markdown->HTML, photo upload by bytes
  src/feed/chips-feed.js    Durable Object: ws client + state cache + 60s alarm
  src/lib/chips.js          HTTP RPC client (retry 429/502/503)
  src/lib/format.js         arg(), dateRange(), formatters
  src/lib/metrics.js        D1 counters
  public/                   static landing page (ticker + metrics are fetched live)
  migrations/0001_metrics.sql
  scripts/register-discord.js  register-telegram.js  smoke.js  e2e_telegram_webhook.js
  test/                     node --test (14 tests, offline)
```

## Environments (never test against production)

| | production | dev |
|---|---|---|
| deploy | `npx wrangler deploy` | `npx wrangler deploy --env dev` |
| worker | `chips-bot` | `chips-bot-dev` |
| host | **bot.chips.gg** | **bot-cf.chips.gg** |
| Discord app | `901908108136308757` Chips.gg VIP Assistant (Chips Casino 16.8k + 11 guilds) | `1326290512675606548` devbot (no guilds; DM it) |
| Telegram | `@chipsgg_official_bot` | `@chipsgg_dev_bot` |
| D1 | `chips-bot-metrics` | `chips-bot-metrics-dev` |
| `/health.environment` | `production` | `dev` |

`scripts/smoke.js` and `scripts/e2e_telegram_webhook.js` **exit 3 if pointed at a prod host**.
Test messages go to Jacob only (`@tacyarg`, TG `147051786`), never to a player or a public channel.
Prod tokens live only as secrets on the production worker; nothing else on disk or in scripts.

## Secrets

Set per environment: `wrangler secret put <NAME>` (prod) / `wrangler secret put <NAME> --env dev`.

| Name | Purpose |
|---|---|
| `CHIPS_TOKEN` | operator token: staff checks + `/affiliate`. Root-tier, reads only. |
| `DISCORD_APPLICATION_ID` / `DISCORD_PUBLIC_KEY` | from `GET /applications/@me` with the bot token (`verify_key`) |
| `DISCORD_TOKEN` | role assignment on `/linkaccount`, command registration |
| `TELEGRAM_TOKEN` | Bot API |
| `TELEGRAM_WEBHOOK_SECRET` | random; Telegram echoes it as `X-Telegram-Bot-Api-Secret-Token` |

Local dev: `.dev.vars` (gitignored) with the dev values; `npm run dev`; `npm run smoke`.

## Deploy

```
cd worker
npm test && npm run lint
npx wrangler deploy --env dev && node scripts/smoke.js https://bot-cf.chips.gg
npx wrangler deploy                      # production, after dev is green
curl https://bot.chips.gg/health         # read-only prod check
```

## Cutover (done 2026-09-16)

Replit deployment stopped; `bot.chips.gg` DNS record deleted by hand (wrangler token is zone:read);
`wrangler deploy` bound the custom domain; Telegram `setWebhook` + Discord `interactions_endpoint_url`
pointed at `https://bot.chips.gg`. D1 seeded from the Replit counters. Rollback = point both back
to empty (Discord gateway mode / Telegram polling) and start any long-running copy of the Node bot.

Post-cutover TODO: **rotate** the Discord bot token, both Telegram tokens and the Chips operator token
(they were shared in chat during the migration), then `secret put` the new values.

## Behaviour notes

- `stats.chips.gg` renders `/stats/<user>` fine but currently 404s on `/koth`, `/bets/<id>`,
  `/promotions/<id>` and 500s on `/compare`. Telegram cannot fetch dynamic image URLs, so the
  Worker downloads the banner and uploads bytes; when the renderer 404s the form falls back to
  text + a link. Discord embeds the URL directly (Discord fetches it).
- `/prices`, `/bigwins`, `/luckiest` read DO state. First request after a cold start returns
  "warming up" for ~1s while the socket opens; `/health` reports `stale` after 5 min without pushes.
- Identity commands (`linkaccount checkaccount myaffiliates affiliate`) are not reachable over the
  HTTP demo API (404). `/affiliate` is hidden from `/help`, `/commands.json`, and the TG menu.
- D1 was seeded from the Replit counters at cutover (1,389 commands / 864 Discord / 54 Telegram).
