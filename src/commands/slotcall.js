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
    let slot = await api.getRandomSlot();

    if (ctx.platform !== "discord") {
      return ctx.sendForm(
        models.slotcall({
          ...slot,
        })
      );
    }

    const message = await ctx.interaction.editReply(randomSlotReply(slot));

    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== ctx.interaction.user.id) {
        return interaction.reply({
          content: "Run the command yourself to use this button!",
          ephemeral: true,
        });
      }

      if (interaction.customId === "slotcall") {
        collector.resetTimer();

        slot = await api.getRandomSlot();
        await interaction.update(randomSlotReply(slot));
      }
    });

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

function randomSlotReply(slot) {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: slot.title,
      url: `https://chips.gg/play/${slot.slug}`,
    })
    .setDescription(
      `:tophat: ${slot.producer}\n:moneybag: RTP **${slot.rtp}%**\n-# :label: ${slot.tags.join(", ")}`
    );
  if (slot.images.s1) {
    embed.setThumbnail(slot.images.s1);
  } else if (slot.images.bg) {
    embed.setThumbnail(slot.images.bg);
  }

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
