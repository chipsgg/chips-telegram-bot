#!/usr/bin/env node
/**
 * Bulk-overwrite the bot's GLOBAL Discord slash commands from the registry.
 * Needs DISCORD_APPLICATION_ID + DISCORD_TOKEN in the environment (never commit them).
 *   DISCORD_APPLICATION_ID=... DISCORD_TOKEN=... node scripts/register-discord.js [--dry]
 * Global commands propagate within ~1h; the list is identical to the Node bot's so users see no change.
 */
import { discordCommandPayload } from "../src/commands/index.js";
import { registerCommands } from "../src/platform/discord-rest.js";

const payload = discordCommandPayload();
if (process.argv.includes("--dry")) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}
const env = {
  DISCORD_APPLICATION_ID: process.env.DISCORD_APPLICATION_ID,
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
};
if (!env.DISCORD_APPLICATION_ID || !env.DISCORD_TOKEN) {
  console.error("set DISCORD_APPLICATION_ID and DISCORD_TOKEN");
  process.exit(1);
}
const r = await registerCommands(env, payload);
console.log(
  r.ok
    ? `registered ${payload.length} global commands`
    : `FAILED ${r.status}: ${r.body.slice(0, 400)}`
);
process.exit(r.ok ? 0 : 1);
