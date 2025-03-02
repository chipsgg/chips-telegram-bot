import { MessageFlags } from 'discord.js';
import { ChipsCommand, CommandAccess, CommandType } from '../../../lib/commands/index.js';
import { discordEmbed, getRandomSlot } from '../randomslot.js';

const command = new ChipsCommand<Process>({
	name: 'SLOTCALL',
	description: 'Get a random slot!',
	// Button command, won't show up in help command or command list
	type: CommandType.Button,
	access: CommandAccess.Everywhere,

	// Example of a preprocess function that passes context to platform handlers
	process: getRandomSlot,
});

export default command;

command.handlers.discord = async ({ interaction, processed }) => {
	if (!interaction.isButton()) return;

	if (interaction.user.id !== interaction.message.interactionMetadata?.user.id) {
		return interaction.reply({
			content: 'Run the command yourself to get a random slot!',
			flags: [MessageFlags.Ephemeral],
		});
	}

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

	await interaction.update(discordEmbed(processed));
};

type Process = {
	error?: string;
	slot?: {
		id: string;
		title: string;
		slug: string;
		tags: string[];
		rtp: string;
		provider: string;
		producer: string;
		images: {
			bg?: string;
			[key: string]: string | undefined;
		};
	};
};
