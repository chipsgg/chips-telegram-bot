import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { ChipsCommand, CommandAccess, CommandType, SlashCommandOptionType } from '../../lib/commands/index.js';

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
		},
	},
});

export default command;

command.handlers.discord = async ({ sdk, interaction, createEmbed }) => {
	if (!interaction.isChatInputCommand()) return;

	await interaction.deferReply();

	const username = interaction.options.getString('username');
	if (!username) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'Please provide a valid username!',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const existingUser = await sdk.public('getUser', { userid: username }).catch(() => null);
	if (!existingUser) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'User not found!',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const linkBtn = new ButtonBuilder()
		.setStyle(ButtonStyle.Link)
		.setLabel(`View ${username.slice(0, 19)}`)
		.setURL('https://chips.gg/user/' + username);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel('More Stats').setCustomId('stats'),
		linkBtn,
	);

	const reply = await interaction.editReply({
		files: [new AttachmentBuilder('https://stats.chips.gg/stats/' + username, { name: `${username}.png` })],
		components: [row],
	});

	const collector = reply.createMessageComponentCollector({
		filter: (i) => i.customId === 'stats',
		time: 60000,
	});

	collector.on('collect', async (i) => {
		if (i.user.id !== interaction.user.id) {
			await i.reply({
				content: 'Use this command yourself to view more info!',
				ephemeral: true,
			});
			return;
		}

		await i.deferUpdate();

		const player = await sdk
			.public('getPlayer', {
				userid: existingUser.id,
			})
			.catch(() => null);

		if (!player) {
			await i.editReply({
				components: [new ActionRowBuilder<ButtonBuilder>().addComponents(linkBtn)],
			});

			await i.followUp({
				content: 'Failed to fetch user stats!',
				flags: [MessageFlags.Ephemeral],
			});

			return;
		}

		const { stats, vip } = player;

		const embed = createEmbed();
		embed.setAuthor({
			name: `${username} Stats`,
			url: 'https://chips.gg/user/' + username,
		});
		embed.setThumbnail(player.avatar);

		const description = [
			`Username: **${existingUser.username}**`,
			`Level: **${vip?.rank || 'None!'}** (${vip?.level || '0'})`,
			`Total Bets: **${stats.count?.toLocaleString() || 0}**`,
			`Total Wins: **${stats.wins?.toLocaleString() || 0}**`,
			`Total Wagered: **$${(stats.wageredUsd || 0).toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})}**`,
			`Total Bonuses: **$${(stats.bonusesUsd || 0).toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})}**`,
			`Join Date: <t:${Math.floor(existingUser.created / 1000)}:D>`,
		].join('\n');

		embed.setDescription(description);

		await i.editReply({
			embeds: [embed],
			components: [new ActionRowBuilder<ButtonBuilder>().addComponents(linkBtn)],
		});
	});

	collector.on('end', () => {
		reply
			.edit({
				components: [new ActionRowBuilder<ButtonBuilder>().addComponents(linkBtn)],
			})
			.catch(() => undefined);
	});
};
