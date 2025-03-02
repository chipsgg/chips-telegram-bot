import { formatCurrency } from '@coingecko/cryptoformat';
import { MessageFlags } from 'discord.js';
import { ChipsCommand, CommandAccess, CommandType } from '../../lib/commands/index.js';

const command = new ChipsCommand<Process>({
	name: 'luckiest',
	description: 'Rankings of the luckiest players on Chips.gg!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	process: async (ctx) => {
		await ctx.deferReply();

		const prices = {} as Record<string, { decimals: number; price: number }>;

		const bigwins = (await ctx.sdk.get('stats', 'bets', 'luckiest')) as Record<string, Win>;

		for (const win of Object.values(bigwins)) {
			const { bet } = win;
			prices[bet.currency] ??= await ctx.sdk.get('public', 'currencies', bet.currency);
			win.currency = prices[bet.currency];

			bet.amountInUsd = (+bet.amount / Math.pow(10, win.currency.decimals)) * win.currency.price;
			bet.winningsInUsd = (+bet.winnings / Math.pow(10, win.currency.decimals)) * win.currency.price;
		}

		const wins = Object.values(bigwins).sort((a, b) => b.bet.multiplier - a.bet.multiplier);

		return {
			wins,
		};
	},
});

export default command;

command.handlers.discord = async ({ interaction, processed, createEmbed }) => {
	if (!interaction.isChatInputCommand() || !processed) return;

	const { wins } = processed;
	if (!wins) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'No data found! Please try again later.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const description = wins
		.filter((value, i, array) => array.findIndex((v) => v.userid === value.userid) === i)
		.slice(0, 10)
		.map((win, i) => {
			const { player, bet, game } = win;
			const { username } = player;
			const { amountInUsd, winningsInUsd, multiplier } = bet;
			const { title, slug } = game;

			return (
				`${i + 1}. ${formatCurrency(amountInUsd, 'USD', 'en')} ➜ **${formatCurrency(winningsInUsd, 'USD', 'en')}** (${multiplier.toFixed(2)}x)\n` +
				`-# Won by [${username}](https://chips.gg/user/${username}) in [${title}](https://chips.gg/play/${slug})`
			);
		})
		.join('\n');

	const embed = createEmbed();
	embed.setTitle('🎰 Luckiest Wins 🎰');
	embed.setDescription(description);

	await interaction.editReply({
		embeds: [embed],
	});
};

type Process = {
	wins: Win[];
};

export interface Win {
	created: number;
	id: string;
	userid: string;
	bet: Bet;
	score: number;
	game: Game;
	vip: Vip;
	player: Player;
	currency: {
		decimals: number;
		price: number;
	};
}

export interface Bet {
	id: string;
	done: boolean;
	created: number;
	updated: number;
	outcome: null[];
	win: boolean;
	gameprovider: string;
	ruleset: string;
	gamename: string;
	gamecode: string;
	roomid: string;
	amount: string;
	currency: string;
	multiplier: number;
	winnings: string;
	clientSeed: string;
	nonce: number;
	serverHash: string;
	userid: string;
	amountInUsd: number;
	winningsInUsd: number;
}

export interface Game {
	id: string;
	title: string;
	provider: string;
	producer: string;
	images: null[];
	slug: string;
	tags: null[];
	rtp: number;
}

export interface Player {
	id: string;
	username: string;
	nickname: string;
	avatar: string;
	isPrivate: boolean;
}

export interface Vip {
	exp: number;
	level: number;
	tier: number;
	rank: string;
	baseLevelExp: number;
	nextLevelExp: number;
}
