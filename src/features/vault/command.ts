import { formatCurrency } from '@coingecko/cryptoformat';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { ChipsCommand, CommandAccess, CommandType } from '../../lib/commands/index.js';
import { fetchCurrencies } from '../../lib/utils.js';

const command = new ChipsCommand<Process>({
	name: 'vault',
	description: 'Get the status of the Chips.gg vault!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	process: async (ctx) => {
		await ctx.deferReply();

		const vault = (await ctx.sdk.get('profitshare', 'profitshareInfo')) as Process['vault'];
		const balances = (await ctx.sdk.get('profitshare', 'profitshareBalance')) as Record<string, number>;
		const coins = (await fetchCurrencies(ctx.sdk)) ?? {};

		const currencies = Object.values(coins)
			.filter(({ name, hidden }) => !hidden && name !== 'chips' && name !== 'chips_staking')
			.map(({ name, price, decimals }) => ({
				name: name.toUpperCase(),
				value: (balances[name] ?? 0) / Math.pow(10, decimals) || 0,
				price: price || 1,
			}));
		const totalValue = currencies.reduce((acc, { value, price }) => acc + value * price, 0);
		const perThousand = (totalValue / 4 / +vault.totalStaked) * 1000;

		return {
			vault,
			currencies,
			totalValue,
			perThousand,
		};
	},
});

export default command;

command.handlers.discord = async ({ interaction, processed, createEmbed }) => {
	if (!interaction.isChatInputCommand() || !processed) return;

	const { vault } = processed;
	if (!vault) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'No vault data found! Please try again later.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const fields = [
		{
			name: 'Total Value',
			value: '**' + formatCurrency(processed.totalValue, 'USD', 'en') + '**',
			inline: true,
		},
		{
			name: 'Next Distribution',
			value: `<t:${Math.floor(vault.distributeAt / 1000)}:R>`,
			inline: true,
		},
		{
			name: `\u200b`,
			value: `\u200b`,
			inline: true,
		},
		{
			name: (+vault.totalStaked / Math.pow(10, vault.decimals)).toLocaleString(),
			value: '-# Total Locked Chips',
			inline: true,
		},
		{
			name: (+vault.totalMinted / Math.pow(10, vault.decimals)).toLocaleString(),
			value: '-# Total Minted Chips',
			inline: true,
		},
		{
			name: (100_000_000).toLocaleString(),
			value: '-# Total Supply',
			inline: true,
		},
		{
			name: 'Coins',
			value: processed.currencies
				.sort((a, b) => b.value * b.price - a.value * a.price)
				.map(({ name, value, price }) => {
					const total = value * price;
					return `${name} • **${formatCurrency(total, 'USD', 'en')}** \`${value.toLocaleString()}\``;
				})
				.join('\n'),
		},
	];

	const embed = createEmbed();
	embed.setAuthor({
		name: '💰 Chips.gg Vault 💰',
		url: 'https://chips.gg/vault',
	});
	embed.setFields(fields);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('View Vault').setURL('https://chips.gg/vault'),
	);

	await interaction.editReply({
		embeds: [embed],
		components: [row],
	});
};

type Process = {
	vault: {
		currency: 'chips';
		limit: '100000000000000';
		decimals: 6;
		mintid: 'mint';
		stakingcurrency: 'chips_staking';
		totalStaked: string;
		totalMinted: string;
		totalUnminted: string;
		distributeAt: number;
		distributionDuration: number;
		chipsPerDollar: string;
		difficultyLevel: string;
	};
	currencies: {
		name: string;
		value: number;
		price: number;
	}[];
	totalValue: number;
	perThousand: number;
};
