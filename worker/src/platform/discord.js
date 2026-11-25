/**
 * Discord Interactions endpoint (HTTP, no gateway).
 *
 * Flow: verify Ed25519 signature -> PING? PONG -> ACK with type 5 (deferred) within 3s
 * -> run the handler in ctx.waitUntil -> PATCH the original response via webhook.
 * Component (button) interactions: type 3, customId "reroll:<command>" re-runs that command
 * and updates the message in place (type 7 is not usable after a webhook edit, so we PATCH).
 * Support inbox: "support:reply" opens a modal, its submit (type 5) goes to RELAY.inbound;
 * "csat:<token>:<n>" goes to RELAY.csat. Plain DMs arrive via the gateway box (gateway/, discordDm).
 */
import { commands, linkPrompt } from "../commands/index.js";
import { parseCsat, relayInbound, storeFile } from "../inbox.js";
import { resolveLink } from "../lib/links.js";
import { rateLimitMessage } from "../lib/ratelimit.js";
import {
  REPLY_ROW,
  applyEphemeral,
  discordMakeForm,
  postDiscordChannel,
} from "./discord-rest.js";

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
  await deps.feed?.mark("discord");
  const rl = await deps.feed.ratelimit(`discord:${ctx.userid}`);
  if (!rl.allowed) {
    await editOriginal(
      env,
      interaction,
      applyEphemeral({ content: rateLimitMessage(rl.retryAfterSec) })
    );
    return;
  }
  try {
    await command.handler(ctx, deps);
    let body = ctx.result() || { content: "No response." };
    if (command.ephemeral) body = applyEphemeral(body);
    await editOriginal(env, interaction, body);
    await deps.metrics.track("discord", commandName, true);
  } catch (err) {
    console.error(`[discord] /${commandName} failed:`, err.message);
    await deps.metrics.track("discord", commandName, false);
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

  // 3 = MESSAGE_COMPONENT (reroll, support Reply, CSAT buttons)
  if (interaction.type === 3) {
    if (interaction.data?.custom_id === "support:reply")
      return Response.json(SUPPORT_MODAL);
    const vote = parseCsat(interaction.data?.custom_id);
    if (vote) {
      const r = await env.RELAY?.csat(vote).catch((err) => ({
        error: err.message,
      }));
      if (r?.ok)
        return Response.json({ type: 7, data: { components: [REPLY_ROW] } });
      return Response.json({
        type: 4,
        data: {
          content: "That rating was already recorded or has expired.",
          flags: 64,
        },
      });
    }
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

  // 5 = MODAL_SUBMIT (the support message)
  if (
    interaction.type === 5 &&
    interaction.data?.custom_id === "support:modal"
  ) {
    waitUntil(discordInbound(interaction, env, deps));
    return Response.json({ type: 5, data: { flags: 64 } });
  }

  return Response.json({
    type: 4,
    data: { content: "Unsupported interaction.", flags: 64 },
  });
}

// Label (18) wrapping a paragraph text input (4) and a file upload (19).
const SUPPORT_MODAL = {
  type: 9,
  data: {
    custom_id: "support:modal",
    title: "Message Chips Support",
    components: [
      {
        type: 18,
        label: "Your message",
        component: {
          type: 4,
          custom_id: "text",
          style: 2,
          max_length: 2000,
          required: true,
        },
      },
      {
        type: 18,
        label: "Screenshots or files",
        description: "Optional, up to 4.",
        component: {
          type: 19,
          custom_id: "files",
          min_values: 0,
          max_values: 4,
          required: false,
        },
      },
    ],
  },
};

// custom_id -> value (text input) or values (file upload ids), at any nesting (rows or labels)
export const modalFields = (components, out = {}) => {
  for (const c of components || []) {
    if (c.custom_id) out[c.custom_id] = c.values ?? c.value;
    modalFields(c.components ?? (c.component ? [c.component] : []), out);
  }
  return out;
};

const SORRY =
  "Sorry, your message didn't reach the team. Please try again in a minute.";

/**
 * Shared by the modal and plain DMs. Linked: files to R2 (dc/<key>/i), RELAY.inbound with idem
 * dc:<key> (interaction and message ids are both snowflakes, so they never collide).
 * Returns { form } (link prompt, nothing stored), { content } (file refused) or { sent, auto }.
 */
async function toInbox(env, deps, { userId, key, text, files }) {
  await deps.feed?.mark("discord");
  const link = await resolveLink(deps, "discord", userId);
  if (!link) return { form: linkPrompt({ platform: "discord" }) };
  const attachments = [];
  for (const [i, f] of files.entries()) {
    const a = await storeFile(env, "dc", `${key}/${i}`, {
      url: f.url,
      name: f.filename,
      type: f.content_type || "application/octet-stream",
      size: f.size,
    });
    if (a.error) return { content: a.error };
    attachments.push(a);
  }
  const r = await relayInbound(env, {
    channel: "discord",
    link,
    platformId: userId,
    idem: `dc:${key}`,
    extId: key,
    text,
    attachments,
  });
  if (r?.error) throw new Error(r.error);
  return { sent: true, auto: r?.auto?.text };
}

/** A support modal submit; the answer is the interaction's ephemeral reply. */
export async function discordInbound(interaction, env, deps) {
  const userId = String(interaction.member?.user?.id || interaction.user?.id);
  const reply = (body) => editOriginal(env, interaction, applyEphemeral(body));
  try {
    const fields = modalFields(interaction.data.components);
    const resolved = interaction.data.resolved?.attachments || {};
    const files = (fields.files || [])
      .map((id) => resolved[id])
      .filter(Boolean);
    const out = await toInbox(env, deps, {
      userId,
      key: interaction.id,
      text: fields.text,
      files,
    });
    if (out.form) return await reply(discordMakeForm(out.form));
    const sent = "Sent to Chips Support. Answers arrive in your DMs with me.";
    await reply({
      content: out.sent
        ? [sent, out.auto].filter(Boolean).join("\n\n")
        : out.content,
    });
  } catch (err) {
    console.error("[inbox] discord inbound failed:", err.message);
    await reply({ content: SORRY });
  }
}

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * A plain DM, poked by the gateway box with { channel_id, id }. Nothing else from the box is
 * trusted: the channel must be a DM (type 1) and the message is re-read from Discord, so author,
 * text and files are Discord's. Like Telegram: silent on success except the relay's auto-reply.
 */
export async function discordDm(env, deps, { channel_id, id }) {
  if (!SNOWFLAKE.test(channel_id) || !SNOWFLAKE.test(id)) return "bad ids";
  const get = async (path) => {
    const res = await fetch(`${DISCORD_API}${path}`, {
      headers: { authorization: `Bot ${env.DISCORD_TOKEN}` },
    });
    if (!res.ok) throw new Error(`discord ${res.status} ${path.split("/")[1]}`);
    return res.json();
  };
  const channel = await get(`/channels/${channel_id}`);
  if (channel.type !== 1) return "not a dm";
  const m = await get(`/channels/${channel_id}/messages/${id}`);
  if (m.author?.bot || !(m.content || m.attachments?.length)) return "ignored";
  const say = (form) => postDiscordChannel(env, channel_id, form);
  try {
    const out = await toInbox(env, deps, {
      userId: m.author.id,
      key: m.id,
      text: m.content,
      files: m.attachments || [],
    });
    if (out.form) await say(out.form);
    else if (out.content || out.auto)
      await say({ content: out.content || out.auto });
    return "ok";
  } catch (err) {
    console.error("[inbox] discord dm failed:", err.message);
    await say({ content: SORRY });
    return "failed";
  }
}
