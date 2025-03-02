import { MessageFlags } from 'discord.js';
import { ChipsCommand, CommandAccess, CommandType } from '../../lib/commands/index.js';

const command = new ChipsCommand<Process>({
	name: 'mostplayed',
	description: 'Get the most played games on Chips.gg!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	process: async (ctx) => {
		await ctx.deferReply();

		const games = await ctx.sdk
			.public('listGamesMostPlayed', {
				skip: 0,
				limit: 10,
				duration: '1m',
			})
			.catch(() => null);

		return {
			games,
		};
	},
});

export default command;

command.handlers.discord = async ({ interaction, processed, createEmbed }) => {
	if (!interaction.isChatInputCommand() || !processed) return;

	const { games } = processed;
	if (!games) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'No data found! Please try again later.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const description = games
		.map((game, i) => {
			const { title, slug, provider } = game;

			return `${i + 1}. **[${title}](https://chips.gg/play/${slug})** by [${provider}](https://chips.gg/casino/providers/${provider})`;
		})
		.join('\n');

	const embed = createEmbed();
	embed.setTitle('🎮 Most Played Games 🎮');
	embed.setDescription(description);

	await interaction.editReply({
		embeds: [embed],
	});
};

type Process = {
	games:
		| {
				id: string;
				title: string;
				provider: string;
				producer: string;
				images: {
					bg?: string;
					[key: string]: string | undefined;
				};
				slug: string;
				tags: string[];
				rtp: string;
				stats: {
					wageredUsd: number;
					profitMaxUsd: number;
					wageredMaxUsd: number;
					count: number;
					wins: number;
				};
		  }[]
		| null;
};
