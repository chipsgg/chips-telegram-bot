# Discord gateway box

Discord delivers plain messages (DMs included) only over the gateway, a WebSocket the bot keeps open.
The Worker can't, so this process does, on its own small Vultr box. It forwards `{ channel_id, id }` of
each DM to `POST /discord/gateway`; the Worker re-reads the message from Discord and runs the support
inbox flow (same as the `/support` form). It pings every minute; `/health` reports a problem after
5 minutes of silence and the watchdog alerts.

## Box

`chips-discord-gw`: Vultr ORD, vc2-1c-1gb, Ubuntu 24.04, Node 22 (NodeSource), user `gw`, repo at
`/opt/chips-telegram-bot`, systemd unit `chips-discord-gw.service`, no inbound ports but SSH (key only).
Stateless: rebuild from this README and re-run the hand-off.

`gateway.env` (0600, owner gw): `DISCORD_TOKEN`, `GATEWAY_SECRET` (same value as the Worker secret),
optional `WORKER_URL` (default `https://bot.chips.gg`).

## Token hand-off (no copy exists outside the Worker; never roll it for this)

1. Box: `node unseal.js keygen` prints a public key.
2. Worker: `wrangler secret put DISCORD_SEAL_PUB` with that public key.
3. Admin machine: `curl -X POST https://bot.chips.gg/admin/seal-discord -H "x-admin-secret: ..." > sealed.json`,
   copy `sealed.json` to the box. It only opens with the box's key.
4. Box: `node unseal.js open sealed.json`.
5. Worker: `wrangler secret delete DISCORD_SEAL_PUB` (the route answers 404 again).

## Operate

`systemctl status chips-discord-gw`, `journalctl -u chips-discord-gw -f`. Update: `git pull && npm ci
--omit=dev --prefix gateway && systemctl restart chips-discord-gw`. Off: `systemctl disable --now
chips-discord-gw` and `wrangler secret delete GATEWAY_SECRET` (the health check turns off with it).
