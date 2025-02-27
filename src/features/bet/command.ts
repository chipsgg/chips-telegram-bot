import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CommandType, ChipsCommand, CommandAccess, SlashCommandOptionType } from "../../lib/commands/index.js";

const command = new ChipsCommand({
	name: 'bet',
	description: 'View bet information!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	//! It's clear what betid is since it doesn't work with the sdk
	//! I doubt users will know what it is to input it to this command also, so it's disabled for now
	disabled: true,
	options: {
		betid: {
			name: 'betid',
			description: 'The ID of the bet you want to view',
			type: SlashCommandOptionType.String,
			required: true,
		}
	}
});

export default command;

command.handlers.discord = async ({ interaction, sdk }) => {
	if (!interaction.isChatInputCommand()) return;

	const betId = interaction.options.getString('betid', true);

	const decoded = decodeURIComponent(betId);
	const split = decoded.split(':');
	const gamename = split[0];
	const id = split.at(-1);

	if (!betId || !id || !gamename) {
		await interaction.reply({
			content: 'Please provide a valid bet ID!',
			flags: [MessageFlags.Ephemeral]
		});
		return;
	}

	await interaction.deferReply();

	const bet = await sdk.public('getBet', { 
		betid: id,
		gamename: gamename
	}).catch(() => null);

	if (!bet || !betId) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'Bet not found!',
			flags: [MessageFlags.Ephemeral]
		});
		return;
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Link)
			.setLabel('View Bet')
			.setURL('https://chips.gg/bets/' + encodeURIComponent(betId))
	);

	await interaction.editReply({
		files: [
			new AttachmentBuilder('https://stats.chips.gg/bets/' + encodeURIComponent(betId), { name: 'bet.png' })
		],
		components: [row]
	});
}