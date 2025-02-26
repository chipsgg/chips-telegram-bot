import { CommandType, ChipsCommand, CommandAccess, SlashCommandOptionType } from "../../lib/commands/index.ts";

const command = new ChipsCommand<{
	content: string;
}>({
	name: 'bet',
	description: 'View bet information!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	options: {
		betid: {
			name: 'betid',
			description: 'The ID of the bet you want to view',
			type: SlashCommandOptionType.Integer,
			required: true,
		}
	},
	handlers: {
		discord: async (ctx) => {
			await ctx.interaction.reply(`You want to view bet ${ctx.options.betid}!`);
		}
	}
});

export default command;