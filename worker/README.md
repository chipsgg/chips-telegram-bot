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

## Two runtimes, one codebase

```
src/app.js              (Request) -> Response: every route, no runtime imports
src/commands/*          the 19 commands, platform-agnostic
src/platform/*          Discord interactions (Ed25519) + Telegram webhook handlers
src/feed/core.js        FeedCore: the api.chips.gg websocket + pushed state, runtime-agnostic
src/lib/metrics.js      { track, read } over D1, node:sqlite, or memory

src/index.js            Cloudflare Worker: Durable Object feed, D1 metrics, ASSETS
src/adapters/node.js    Node >= 22.5: in-process feed, sqlite file, static from ./public
```

Production is the Worker. The Node adapter exists so the same bot can run anywhere else
(Docker, a VPS, Fly, local laptop) with zero runtime dependencies. Both entrypoints are
~40 lines; a fix lands once in the shared code and both runtimes get it.

```
npm run dev:node                     # local, reads ./.env (copy .env.example), watches for changes
docker build -t chips-bot . && docker run --rm -p 5000:5000 --env-file .env -v chips-bot-data:/data chips-bot
node scripts/smoke.js http://localhost:5000
```

Discord and Telegram need a public HTTPS URL to deliver to a Node instance (reverse proxy, or
`cloudflared tunnel --url http://localhost:5000` for local testing); set `PUBLIC_URL` to it so
`/health` can verify the wiring, then run the same `scripts/register-*.js` as for the Worker.
The dev bot pair (devbot + @chipsgg_dev_bot) is for this; never point prod bots at a laptop.

## Changelog on the landing page

`bot.chips.gg` renders the last six GitHub Releases under `/// CHANGELOG`, with the running
version marked `HEAD`. Source is `GET /api/changelog`, which reads
`api.github.com/repos/chipsgg/chips-telegram-bot/releases` and memoises the result for 10
minutes in the feed Durable Object's storage (GitHub allows 60 unauthenticated calls an hour;
a failed refresh keeps serving the last good copy). Dependabot/renovate bullets are dropped.

Release notes are the product changelog, so write them for players: a one-line story under the
heading, then bullets. `release.yml` publishes GitHub's generated notes; edit them after the tag
with `gh release edit vX.Y.Z --title "..." --notes-file notes.md` and the page picks it up on the
next refresh.

## Proactive features (v4.2)

All off by default in production until the target ids are set in `wrangler.toml [vars]`.

| feature | trigger | config | status surface |
|---|---|---|---|
| Big-win posts | feed pushes to `stats.bets.bigwins` (coalesced 1.5s) | `BROADCAST_DISCORD_CHANNELS`, `BROADCAST_TELEGRAM_CHATS`, `BROADCAST_MIN_USD` (1000), `BROADCAST_MIN_MULTIPLIER` (500), `BROADCAST_MAX_PER_FLUSH` (3) | `/health.feed.broadcast` |
| New-promotion posts | polled on the feed alarm (60s) | same targets | `/health.feed.promotions` |
| Uptime watchdog | cron `* * * * *` | `PUBLIC_HOST`, `ALERT_TELEGRAM_CHAT` | one Telegram message per up/down transition; 2 consecutive fails to alarm |
| VIP rank -> Discord role sync | cron `17 4 * * *` | `DISCORD_ROLES_GUILD_ID` | registry `linked_discord` (D1), filled by `/linkaccount` + `/checkaccount`; 150 members/run, least-recently-synced first |
| Rate limit | every command | tiers in `src/lib/ratelimit.js`: 10/min per user (Discord, Telegram), 60/min per IP (API) | 429 + `Retry-After` on the API; "Easy there" reply in chat |
| Per-command usage | every command | | `GET /api/usage?days=30` |
| Help on bare text | Telegram DM text, or `@bot` mention in a group | `TELEGRAM_BOT_USERNAME` | |

Cold-start rule for both announcers: the first observation records the current board / promo
list silently, so a deploy never re-posts history. On non-production, `POST /api/broadcast-test`
(`?kind=promotion`) sends a synthetic card to the configured targets, and `x-smoke-bypass: 1`
lifts the API rate limit for `scripts/smoke.js`; production ignores both.

## Versioning + deploy

One source of truth: **git tags `vX.Y.Z`**. `wrangler.toml` carries no version; `scripts/deploy.js`
stamps `VERSION` / `COMMIT` / `BUILT_AT` from `git describe` at deploy time and `/health` reports them.

| build | `/health.version` |
|---|---|
| exactly on tag `v4.1.0`, clean tree | `4.1.0` (release) |
| 3 commits past `v4.1.0` | `4.1.0-3+g403bb4e` (dev build) |
| uncommitted changes | `...dirty` |

```
npm run deploy:dev                 # any commit -> bot-cf.chips.gg, then verifies /health.version matches
npm run release -- patch|minor|major   # on master, clean tree: bumps package.json, commits, tags, pushes
npm run deploy                     # production; REFUSES unless HEAD is exactly on a v* tag (--force = hotfix)
npm run version:show               # what would be stamped
```

The tag push runs `.github/workflows/release.yml`: lint + tests, GitHub Release with generated notes,
then the production deploy using repo secret `CLOUDFLARE_API_TOKEN` (account token scoped to REDPKT,
set Sep 16 2026) + variable `CLOUDFLARE_ACCOUNT_ID`, and finally verifies the edge reports the tag.
The job runs in the GitHub `production` environment, so a required-reviewer gate can be added there
later without touching the workflow. Manual fallback: `npm run deploy`. `.github/workflows/ci.yml` runs lint, tests and a
`wrangler --dry-run` compile on every PR.

The old `docker-publish.yml` (ghcr image of the Node bot, nightly) was removed; nothing consumes it.

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
