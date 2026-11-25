// Holds the Discord gateway for the Worker bot (Workers are request-driven and can't keep it).
// Only pokes the Worker with { channel_id, id } per DM; the Worker re-reads the message from
// Discord itself, so this box can't put words in anyone's mouth. Pings every minute while the
// gateway is Ready so /health shows the connection, not just the process.
import { Client, Events, GatewayIntentBits, Partials, Status } from "discord.js";

const { DISCORD_TOKEN, GATEWAY_SECRET, WORKER_URL = "https://bot.chips.gg" } = process.env;
if (!DISCORD_TOKEN || !GATEWAY_SECRET) throw new Error("DISCORD_TOKEN and GATEWAY_SECRET required");

const post = (body) =>
  fetch(`${WORKER_URL}/discord/gateway`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-gateway-secret": GATEWAY_SECRET },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
    .then((r) => r.ok || console.error("worker", r.status))
    .catch((e) => console.error("worker", e.message));

// DM intent only: no guild messages, no message-content intent. Partials.Channel: DM channels
// aren't cached until the first event, so without it DMs are dropped.
const client = new Client({
  intents: [GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});
client.on(Events.MessageCreate, (m) => {
  if (!m.guildId && !m.author.bot) post({ channel_id: m.channelId, id: m.id });
});
client.once(Events.ClientReady, (c) => {
  console.log(`ready as ${c.user.tag}`);
  const ping = () => client.ws.status === Status.Ready && post({ ping: true });
  ping();
  setInterval(ping, 60_000);
});
client.on(Events.ShardDisconnect, (e) => console.error("gateway closed", e.code));
client.login(DISCORD_TOKEN);
