import { ActionRowBuilder, AutocompleteInteraction, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import type { DiscordPlatformContext } from 'platforms/context.js';
import { ChipsCommand, CommandAccess, CommandType, SlashCommandOptionType } from '../../lib/commands/index.js';

const command = new ChipsCommand({
	name: 'game',
	description: 'Get information about a game!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	options: {
		name: {
			name: 'name',
			description: 'The name of the game!',
			type: SlashCommandOptionType.String,
			autocomplete: gameAutocomplete,
			required: true,
		},
	},
});

export default command;

command.handlers.discord = async ({ sdk, interaction, createEmbed }) => {
	if (!interaction.isChatInputCommand()) return;

	await interaction.deferReply();

	const gameId = interaction.options.getString('name', true);

	const game = await sdk
		.public('getGameDetails', {
			catalogid: gameId,
		})
		.catch(() => null);

	if (!game) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'No data found! Please try again later.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const embed = createEmbed();
	embed.setTitle(game.title);

	const thumb = game.images?.s1 ?? game.images?.s2 ?? game.images?.bg;
	if (thumb) embed.setThumbnail(thumb);

	embed.setDescription(
		`:tophat: ${game.producer}\n:moneybag: RTP **${game.rtp}%**\n-# :label: ${game.tags.join(', ')}`,
	);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Play Now!').setURL(`https://chips.gg/play/${game.slug}`),
	);

	interaction.editReply({
		embeds: [embed],
		components: [row],
	});
};

async function gameAutocomplete({ interaction, sdk }: DiscordPlatformContext<AutocompleteInteraction, undefined>) {
	if (interaction.responded) return;

	const option = interaction.options.getFocused(true);
	if (!option || option.name !== 'name') return;

	const searchString = option.value.replace(/[^a-zA-Z0-9-]/g, '') || undefined;

	if (!searchString) {
		interaction.respond(await topGames());
		return;
	}

	const search = (await sdk
		.public('searchGames', {
			skip: 0,
			limit: 5,
			term: searchString,
		})
		.catch(() => null)) as Game[];

	if (!search || !search.length) {
		interaction.respond(await topGames());
		return;
	}

	interaction.respond(
		search.map((game) => ({
			name: game.title,
			value: game.id,
		})),
	);

	async function topGames() {
		const games = await sdk
			.public('listGamesMostPlayed', {
				skip: 0,
				limit: 10,
				duration: '1m',
			})
			.catch(() => null);

		if (!games) return [];

		return games.map((game) => ({
			name: game.title,
			value: game.id,
		}));
	}
}

interface Game {
	id: string;
	title: string;
	provider: string;
	producer: string;
	images: null[];
	slug: string;
	tags: null[];
	rtp: number;
}
