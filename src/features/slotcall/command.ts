import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CommandType, ChipsCommand, CommandAccess } from "../../lib/commands/index.js";
import { discordEmbed, getRandomSlot, type RandomSlotProcess } from "./randomslot.js";

const command = new ChipsCommand<RandomSlotProcess>({
	name: 'slotcall',
	description: 'Get a random slot!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,

	// Example of a preprocess function that passes context to platform handlers
	process: getRandomSlot,
});

export default command;

command.handlers.discord = async ({ interaction, processed }) => {
	if (!interaction.isChatInputCommand()) return;

	if (processed?.error) {
		return interaction.reply({
			content: processed.error,
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!processed?.slot) {
		return interaction.reply({
			content: 'Failed to fetch slot!',
			flags: [MessageFlags.Ephemeral],
		});
	}

	await interaction.reply(discordEmbed(processed));
};