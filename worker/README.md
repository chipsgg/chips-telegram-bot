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

## Secrets (wrangler secret put)

| Name | Purpose |
|---|---|
| `CHIPS_TOKEN` | operator token: staff checks + `/affiliate`. Root-tier — reads only. |
| `DISCORD_APPLICATION_ID` / `DISCORD_PUBLIC_KEY` | from `GET /applications/@me` with the bot token |
| `DISCORD_TOKEN` | role assignment on `/linkaccount`, command registration |
| `TELEGRAM_TOKEN` | Bot API |
| `TELEGRAM_WEBHOOK_SECRET` | random; Telegram echoes it as `X-Telegram-Bot-Api-Secret-Token` |

Local dev: `.dev.vars` (gitignored) with the same names; `npm run dev`; `npm run smoke`.

## Deploy

```
cd worker
npm test && npm run lint
npx wrangler d1 migrations apply chips-bot-metrics --remote   # idempotent
npx wrangler deploy
node scripts/smoke.js https://bot-cf.chips.gg
```

## Cutover runbook (bot.chips.gg)

The Replit bot fights the Worker for Telegram: Telegraf's `launch()` deletes the webhook to poll.
**Stop the Replit deployment first**, then:

1. **Discord** — set the Interactions Endpoint URL on the production app (`Chips.gg VIP Assistant`,
   `901908108136308757`) to `https://bot.chips.gg/discord`. Discord PINGs it on save and refuses
   the URL if the signature check fails, so a successful save is the test. Needs that app's
   token + public key as the Worker secrets (currently the *devbot* pair is loaded).
   The bot needs **Manage Roles** in the guild for `/linkaccount` role assignment (permissions
   `268435456` on the invite URL).
2. **Telegram** — `TELEGRAM_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… node scripts/register-telegram.js https://bot.chips.gg`
   then `--info` should show the URL and `pending_update_count: 0`.
3. **Domain** — add `{ pattern = "bot.chips.gg", custom_domain = true }` to `routes` in
   `wrangler.toml`, delete the existing `bot.chips.gg` DNS record (points at Replit), `wrangler deploy`.
   Cert issues in ~1 min. `curl https://bot.chips.gg/health` → `{"ok":true,…}`.
4. **Rotate** the Discord + Telegram tokens (they were shared in chat). Rotating also kills any
   stale Replit instance for good. Re-`secret put` the new values.

Rollback: point the Discord endpoint URL back to empty (gateway mode), `register-telegram.js --delete`,
restart Replit. Minutes.

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
