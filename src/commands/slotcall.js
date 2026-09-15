/**
 * Slot Call Command
 * Recommends a random slot game from the Chips.gg catalog.
 * On Discord, displays an embed with game details (producer, RTP, tags)
 * and provides a "Reroll" button for getting a new recommendation.
 * The reroll interaction collector expires after 60 seconds, replacing
 * the reroll button with a direct "Play now!" link.
 * On other platforms, uses the slotcall model for formatting.
 */
const models = require("../libs/models");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = (api) => ({
  name: "slotcall",
  description: "Get a random slot",
  handler: async (ctx) => {
    // Fetch a random slot from the catalog
    let slot = await api.getRandomSlot();

    // Non-Discord: use the slotcall model formatter
    if (ctx.platform !== "discord") {
      return ctx.sendForm(
        models.slotcall({
          ...slot,
        })
      );
    }

    // Discord: send an embed with game info and interactive buttons
    const message = await ctx.interaction.editReply(randomSlotReply(slot));

    // Listen for button interactions (reroll) for 60 seconds
    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    collector.on("collect", async (interaction) => {
      // Only allow the original command invoker to use the reroll button
      if (interaction.user.id !== ctx.interaction.user.id) {
        return interaction.reply({
          content: "Run the command yourself to use this button!",
          ephemeral: true,
        });
      }

      // Handle reroll: fetch a new random slot and update the message
      if (interaction.customId === "slotcall") {
        collector.resetTimer();

        slot = await api.getRandomSlot();
        await interaction.update(randomSlotReply(slot));
      }
    });

    // When the collector expires, replace buttons with a static "Play now!" link
    collector.on("end", async () => {
      const newRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("Play now!")
          .setURL(`https://chips.gg/play/${slot.slug}`)
      );
      await message.edit({ components: [newRow] });
    });
  },
});

/**
 * Builds the Discord embed and action row for a random slot recommendation.
 * Includes game title, producer, RTP, tags, and thumbnail image.
 */
function randomSlotReply(slot) {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: slot.title,
      url: `https://chips.gg/play/${slot.slug}`,
    })
    .setDescription(
      `:tophat: ${slot.producer}\n:moneybag: RTP **${slot.rtp}%**\n-# :label: ${slot.tags.join(", ")}`
    );

  // Use the slot's primary image, falling back to background image
  if (slot.images.s1) {
    embed.setThumbnail(slot.images.s1);
  } else if (slot.images.bg) {
    embed.setThumbnail(slot.images.bg);
  }

  // "Play now!" link button and "Reroll" interactive button
  const linkBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Play now!")
    .setURL(`https://chips.gg/play/${slot.slug}`);
  const rerollBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setLabel("Reroll")
    .setCustomId("slotcall");

  const row = new ActionRowBuilder().addComponents(linkBtn, rerollBtn);

  return { embeds: [embed], components: [row] };
}
