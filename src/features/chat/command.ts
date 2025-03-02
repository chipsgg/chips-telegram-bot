import { AutocompleteInteraction, MessageFlags } from 'discord.js';
import type { DiscordPlatformContext } from 'platforms/context.js';
import {
	ChipsCommand,
	CommandAccess,
	CommandGroup,
	CommandType,
	SlashCommandOptionType,
} from '../../lib/commands/index.js';

const command = new ChipsCommand({
	name: 'chat',
	description: 'Get links to chat with other players!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
});

export default command;

command.handlers.discord = async ({ interaction, createEmbed }) => {
	if (!interaction.isChatInputCommand()) return;

	const embed = createEmbed();
	embed.setTitle('💬 Official Communities');
	embed.setDescription('Join our communities to chat with other players!');
	embed.addFields(
		{
			name: 'Discord',
			value: 'https://discord.gg/chips',
		},
		{
			name: 'Telegram',
			value: 'https://t.me/chipsgg',
		},
	);

	await interaction.reply({
		embeds: [embed],
	});
};
