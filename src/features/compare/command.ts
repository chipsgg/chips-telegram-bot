import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CommandType, ChipsCommand, CommandAccess, SlashCommandOptionType } from "../../lib/commands/index.js";

const command = new ChipsCommand({
	name: 'compare',
	description: 'Compare two users!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	options: {
		first: {
			name: 'first',
			description: 'The username of the player you want to start a comparison with!',
			type: SlashCommandOptionType.String,
			required: true,
		},
		second: {
			name: 'second',
			description: 'The username of the player you want to compare with!',
			type: SlashCommandOptionType.String,
			required: true,
		}
	}
});

export default command;

command.handlers.discord = async ({ sdk, interaction }) => {
	if (!interaction.isChatInputCommand()) return;

	await interaction.deferReply();

	const firstUsername = interaction.options.getString('first', true);
	const secondUsername = interaction.options.getString('second', true);

	const firstExists = await sdk.public('getUser', { userid: firstUsername }).catch(() => null);
	if (!firstExists) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: `User "${firstUsername}" not found!`,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const secondExists = await sdk.public('getUser', { userid: secondUsername }).catch(() => null);
	if (!secondExists) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: `User "${secondUsername}" not found!`,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Link)
			.setLabel(`View ${firstUsername.slice(0, 19)}`)
			.setURL('https://chips.gg/user/' + firstUsername),
		new ButtonBuilder()
			.setStyle(ButtonStyle.Link)
			.setLabel(`View ${secondUsername.slice(0, 19)}`)
			.setURL('https://chips.gg/user/' + secondUsername)
	);

	const image = await fetch(`https://stats.chips.gg/compare/${firstUsername}/${secondUsername}`);
	if (!image.ok) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: `Failed to fetch comparison image! Comparison might be too powerful.`,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	await interaction.editReply({
		files: [
			new AttachmentBuilder(`https://stats.chips.gg/compare/${firstUsername}/${secondUsername}`, { name: `comparison.png` })
		],
		components: [row]
	});
};