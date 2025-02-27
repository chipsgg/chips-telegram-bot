import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CommandType, ChipsCommand, CommandAccess, SlashCommandOptionType } from "../../lib/commands/index.js";

const command = new ChipsCommand({
	name: 'stats',
	description: 'Get user stats banner!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	options: {
		username: {
			name: 'username',
			description: 'The username of the player you want to view!',
			type: SlashCommandOptionType.String,
			required: true,
		}
	}
});

export default command;

command.handlers.discord = async ({ sdk, interaction }) => {
	if (!interaction.isChatInputCommand()) return;

	await interaction.deferReply();

	const username = interaction.options.getString('username');
	if (!username) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'Please provide a valid username!',
			flags: [MessageFlags.Ephemeral]
		});
		return;
	}

	const exists = await sdk.public('getUser', { userid: username });
	if (!exists) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'User not found!',
			flags: [MessageFlags.Ephemeral]
		});
		return;
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Link)
			.setLabel(`View ${username.slice(0, 19)}`)
			.setURL('https://chips.gg/user/' + username)
	);

	await interaction.editReply({
		files: [
			new AttachmentBuilder('https://stats.chips.gg/stats/' + username, { name: `${username}.png` })
		],
		components: [row]
	});
};