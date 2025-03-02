import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { completeMarkdown } from 'lib/utils.js';
import { ChipsCommand, CommandAccess, CommandType, SlashCommandOptionType } from '../../lib/commands/index.js';

const command = new ChipsCommand<Process>({
	name: 'promotions',
	description: 'Get ongoing promotions and events!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	process: async (ctx) => {
		await ctx.deferReply();

		const promotions = await ctx.sdk.public('listRunningPromotions').catch(() => []);

		return {
			promotions: promotions.filter((promotion) => promotion.endTime > Date.now()),
		};
	},
});

export default command;

command.handlers.discord = async ({ interaction, processed, createEmbed }) => {
	if (!interaction.isChatInputCommand() || !processed) return;

	const { promotions } = processed;
	if (!promotions || !Array.isArray(promotions)) return;

	const fields = promotions.slice(0, 6).map((promotion) => {
		const { title, description, subtitle, startTime, endTime, id } = promotion;
		let sub = subtitle;

		if (!sub) {
			const firstLine = description.split('\n')[0];
			if (firstLine.length > 128) {
				sub = firstLine.slice(0, 128) + '...';
			} else {
				sub = firstLine;
			}
		}

		sub = completeMarkdown(sub);

		let time = `Ends <t:${Math.floor(endTime / 1000)}:R>`;
		if (startTime > Date.now()) {
			time = `:alarm_clock: **Starts <t:${Math.floor(startTime / 1000)}:R>** - ${time}`;
		} else {
			time = `:alarm_clock: **Ongoing** - ${time}`;
		}

		return {
			name: '\u200b',
			value: `**[${title}](https://chips.gg/promotions/${id})**\n:pencil: ${sub}\n${time}`,
			inline: false,
		};
	});

	const embed = createEmbed();
	embed.setAuthor({
		name: '✨ Ongoing Chips.gg Promotions ✨',
		url: 'https://chips.gg/promotions',
	});

	embed.addFields(fields);

	const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('View Events').setURL('https://chips.gg/events'),
	);

	await interaction.editReply({
		embeds: [embed],
		components: [actionRow],
	});
};

type Process = {
	promotions: {
		gameprovider: 'chipsgg';
		id: string;
		roomid: string;
		type: 'promotion';
		gamename: 'promotion';
		created: number;
		done: boolean;
		history: { pregame: unknown; running: unknown; cooldown: unknown };
		state: 'cooldown' | 'running';
		bets: {};
		userid: string;
		action: {
			image: string;
			title: string;
			route: string;
		};
		bannerImage: string;
		cardImage: string;
		title: string;
		subtitle: string;
		description: string;
		startTime: number;
		endTime: number;
	}[];
};
