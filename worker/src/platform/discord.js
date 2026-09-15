/**
 * Discord Interactions endpoint (HTTP, no gateway).
 *
 * Flow: verify Ed25519 signature -> PING? PONG -> ACK with type 5 (deferred) within 3s
 * -> run the handler in ctx.waitUntil -> PATCH the original response via webhook.
 * Component (button) interactions: type 3, customId "reroll:<command>" re-runs that command
 * and updates the message in place (type 7 is not usable after a webhook edit, so we PATCH).
 */
import { commands } from "../commands/index.js";
import { track } from "../lib/metrics.js";
import { applyEphemeral, discordMakeForm } from "./discord-rest.js";

const DISCORD_API = "https://discord.com/api/v10";

const hex = (s) =>
  Uint8Array.from(s.match(/.{1,2}/g).map((b) => Number.parseInt(b, 16)));

export async function verifyDiscordRequest(request, publicKey, bodyText) {
  const sig = request.headers.get("x-signature-ed25519");
  const ts = request.headers.get("x-signature-timestamp");
  if (!sig || !ts || !publicKey) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      hex(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      hex(sig),
      new TextEncoder().encode(ts + bodyText)
    );
  } catch {
    return false;
  }
}

// Normalised ctx over a slash-command interaction
function makeCtx(interaction, commandName) {
  const options = interaction.data?.options || [];
  const byName = Object.fromEntries(options.map((o) => [o.name, o.value]));
  const positional = options.map((o) =>
    o.value === undefined ? undefined : String(o.value)
  );
  let response = null;
  return {
    platform: "discord",
    userid: interaction.member?.user?.id || interaction.user?.id,
    guildId: interaction.guild_id,
    isPrivate: !interaction.guild_id,
    commandName,
    getString: (name, index = 1) => {
      if (byName[name] !== undefined && byName[name] !== null)
        return String(byName[name]);
      return positional[index - 1];
    },
    rest: (from = 1) =>
      positional
        .slice(from - 1)
        .filter(Boolean)
        .join(" "),
    sendForm: (form) => {
      response = discordMakeForm(form);
      return response;
    },
    sendText: (text) => {
      response = { content: text };
      return response;
    },
    result: () => response,
  };
}

async function editOriginal(env, interaction, body) {
  const url = `${DISCORD_API}/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    console.error(
      "[discord] editOriginal failed:",
      res.status,
      (await res.text()).slice(0, 200)
    );
}

async function runCommand(env, deps, interaction, commandName) {
  const command = commands[commandName];
  const ctx = makeCtx(interaction, commandName);
  try {
    await command.handler(ctx, deps);
    let body = ctx.result() || { content: "No response." };
    if (command.ephemeral) body = applyEphemeral(body);
    await editOriginal(env, interaction, body);
    await track(env, "discord");
  } catch (err) {
    console.error(`[discord] /${commandName} failed:`, err.message);
    await editOriginal(env, interaction, {
      content: "Something went wrong running that command.",
    });
  }
}

export async function handleDiscord(request, env, deps, waitUntil) {
  const bodyText = await request.text();
  if (
    !(await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY, bodyText))
  ) {
    return new Response("invalid request signature", { status: 401 });
  }
  const interaction = JSON.parse(bodyText);

  // 1 = PING
  if (interaction.type === 1) return Response.json({ type: 1 });

  // 2 = APPLICATION_COMMAND
  if (interaction.type === 2) {
    const name = interaction.data?.name;
    const command = commands[name];
    if (!command)
      return Response.json({
        type: 4,
        data: { content: "Unknown command.", flags: 64 },
      });
    waitUntil(runCommand(env, deps, interaction, name));
    // 5 = DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE; flags 64 = ephemeral
    return Response.json({
      type: 5,
      data: command.ephemeral ? { flags: 64 } : {},
    });
  }

  // 3 = MESSAGE_COMPONENT (reroll button)
  if (interaction.type === 3) {
    const [action, name] = String(interaction.data?.custom_id || "").split(":");
    if (action === "reroll" && commands[name]) {
      // Only the original invoker may reroll
      const invoker =
        interaction.message?.interaction?.user?.id ||
        interaction.message?.interaction_metadata?.user?.id;
      const clicker = interaction.member?.user?.id || interaction.user?.id;
      if (invoker && clicker !== invoker) {
        return Response.json({
          type: 4,
          data: {
            content: "Run the command yourself to use this button!",
            flags: 64,
          },
        });
      }
      waitUntil(runCommand(env, deps, interaction, name));
      return Response.json({ type: 6 }); // DEFERRED_UPDATE_MESSAGE
    }
    return Response.json({ type: 6 });
  }

  return Response.json({
    type: 4,
    data: { content: "Unsupported interaction.", flags: 64 },
  });
}
