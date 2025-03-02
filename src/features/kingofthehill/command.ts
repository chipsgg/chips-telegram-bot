import { MessageFlags } from 'discord.js';
import { ChipsCommand, CommandAccess, CommandType } from '../../lib/commands/index.js';

const command = new ChipsCommand<Process>({
	name: 'koth',
	description: 'Get the current King of the Hill!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	process: async (ctx) => {
		await ctx.deferReply();

		try {
			const koth = await ctx.sdk.get('public', 'koth');
			const currency = (await ctx.sdk.get('public', 'currencies', koth.currency)) as {
				name: string;
				decimals: number;
				price: number;
			};

			return {
				koth,
				currency,
			};
		} catch {
			return {};
		}
	},
});

export default command;

command.handlers.discord = async ({ interaction, processed, createEmbed }) => {
	if (!interaction.isChatInputCommand() || !processed) return;

	const { koth, currency } = processed;
	if (!koth || !currency) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'No data found! Please try again later.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const embed = createEmbed();
	embed.setTitle('👑 King of The Hill 👑');

	const { king, totalWagered, totalWon, totalProfit, catalogGame, totalBets } = koth;
	const { user } = king;

	embed.setDescription(`**${user.username}** is the current King of the Hill!`);
	embed.addFields(
		{
			name: 'Total Bets',
			value: totalBets.toString(),
			inline: true,
		},
		{
			name: 'Total Wagered',
			value:
				((+totalWagered / Math.pow(10, currency.decimals)) * currency.price).toLocaleString() +
				' ' +
				currency.name.toUpperCase(),
			inline: true,
		},
		{
			name: 'Total Won',
			value:
				((+totalWon / Math.pow(10, currency.decimals)) * currency.price).toLocaleString() +
				' ' +
				currency.name.toUpperCase(),
			inline: true,
		},
		{
			name: 'Total Profit',
			value:
				((+totalProfit / Math.pow(10, currency.decimals)) * currency.price).toLocaleString() +
				' ' +
				currency.name.toUpperCase(),
			inline: true,
		},
		{
			name: 'Game',
			value: `[${catalogGame.title}](https://chips.gg/play/${catalogGame.slug})`,
			inline: true,
		},
	);

	if (catalogGame.images?.s1) {
		embed.setThumbnail(catalogGame.images.s1);
	}

	await interaction.editReply({
		embeds: [embed],
	});
};

type Process = {
	koth?: Koth;
	currency?: { name: string; decimals: number; price: number };
};

export interface Koth {
	id: string;
	created: number;
	version: number;
	userid: string;
	state: string;
	currency: string;
	minBet: string;
	amount: string;
	winnings: string;
	catalogid: string;
	multiplier: number;
	winningBet?: WinningBet;
	duration: number;
	endTime: number;
	totalWagered: string;
	totalWon: string;
	totalProfit: string;
	catalogGame: Game;
	creator: Creator;
	updated: number;
	winningsUsdt: string;
	type: string;
	gamename: string;
	provider: string;
	amountUsdt: string;
	game: Game;
	_id: string;
	totalBets: number;
	totalWageredUsd: number;
	totalWonUsd: number;
	totalProfitUsd: number;
	king: King;
	done: boolean;
	winnerid: string;
	winner: Creator;
}

export interface Game {
	id: string;
	title: string;
	provider: string;
	producer: string;
	images: Images;
	slug: string;
	tags: string[];
	rtp: number;
}

export interface Images {
	s2: string;
	bg: string;
	s1: string;
	s3: string;
	s4: string;
}

export interface Creator {
	id: string;
	username: string;
	avatar: string;
	referrer: string;
	isPrivate: boolean;
}

export interface King {
	vip: Vip;
	user: Creator;
}

export interface Vip {
	exp: number;
	level: number;
	tier: number;
	rank: string;
	baseLevelExp: number;
	nextLevelExp: number;
}

export interface WinningBet {
	id: string;
	created: number;
	win: boolean;
	done: boolean;
	type: string;
	amount: string;
	amountUsdt: string;
	userid: string;
	gameid: string;
	gameprovider: string;
	gamename: string;
	gamecode: string;
	multiplier: number;
	currency: string;
	winnings: string;
	winningsUsdt: string;
	updated: number;
	_id: string;
	slotname: string;
	rtp: number;
	condition: string;
	decimals: number;
	price: number;
	walletid: string;
	tags: string[];
	user: Creator;
}
