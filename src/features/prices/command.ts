import { formatCurrency } from '@coingecko/cryptoformat';
import { MessageFlags } from 'discord.js';
import { ChipsCommand, CommandAccess, CommandType } from '../../lib/commands/index.js';
import { fetchCurrencies } from '../../lib/utils.js';

const command = new ChipsCommand<Process>({
	name: 'prices',
	description: 'Get the current prices of supported cryptocurrencies!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	process: async (ctx) => {
		await ctx.deferReply();

		const currencies = (await fetchCurrencies(ctx.sdk)) ?? [];

		return {
			currencies: Object.values(currencies).filter(
				(x) =>
					!x.hidden &&
					x.name !== 'chips' &&
					x.name !== 'chips_staking' &&
					!x.name.startsWith('usd') &&
					!x.name.endsWith('usd'),
			),
		};
	},
});

export default command;

command.handlers.discord = async ({ interaction, processed, createEmbed }) => {
	if (!interaction.isChatInputCommand() || !processed) return;

	const { currencies } = processed;
	if (!currencies || !Array.isArray(currencies)) return;

	if (currencies.length === 0) {
		await interaction.deleteReply();
		await interaction.followUp({
			content: 'No currencies found! Please try again later.',
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const description = currencies
		.map((currency) => {
			const { name, price } = currency;
			return `**${name.toUpperCase()}/USD** ${formatCurrency(price, 'USD', 'en')}`;
		})
		.join('\n');

	const embed = createEmbed();
	embed.setTitle(':chart_with_upwards_trend: Market Prices :chart_with_upwards_trend:');
	embed.setDescription(description);

	await interaction.editReply({
		embeds: [embed],
	});
};

type Process = {
	currencies: {
		hidden: boolean;
		name: string;
		price: number;
	}[];
};
