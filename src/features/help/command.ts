import { AutocompleteInteraction, MessageFlags } from 'discord.js';
import type { DiscordPlatformContext } from 'platforms/context.js';
import {
	ChipsCommand,
	CommandAccess,
	CommandGroup,
	CommandType,
	SlashCommandOptionType,
} from '../../lib/commands/index.js';

const command = new ChipsCommand({
	name: 'help',
	description: 'View all available commands!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	process: undefined,
	options: {
		command: {
			name: 'command',
			description: 'The command you want to view',
			type: SlashCommandOptionType.String,
			autocomplete: commandAutocomplete,
			required: false,
		},
	},
});

export default command;

command.handlers.discord = async ({ interaction, commands, createEmbed }) => {
	if (!interaction.isChatInputCommand()) return;

	const hCommand = interaction.options.getString('command', false) ?? undefined;

	let helpMenu;
	if (!hCommand) {
		helpMenu = getHelpEmbed();
		return interaction.reply({
			embeds: [helpMenu],
			allowedMentions: { repliedUser: false },
			flags: [MessageFlags.Ephemeral],
		});
	} else {
		const [name, sub = ''] = hCommand.toLowerCase().replace('/', '').trim().split('_');
		const cmd = commands.get(name);
		const command = cmd instanceof CommandGroup ? cmd.subcommands[sub] : cmd;

		if (!command || command instanceof CommandGroup || !command.isChatInputCommand()) {
			const embed = getHelpEmbed();
			return interaction.reply({
				content: "That's not a valid command! Here's the menu instead.",
				embeds: [embed],
				allowedMentions: { repliedUser: false },
				flags: [MessageFlags.Ephemeral],
			});
		}

		const embed = createEmbed().setTitle(`Usage for /${command.displayName}`);

		embed.addFields({
			name: 'Command Information',
			value: command.getUsage(true) ?? 'No usage information available.',
			inline: false,
		});

		return interaction.reply({
			embeds: [embed],
			allowedMentions: { repliedUser: false },
			flags: [MessageFlags.Ephemeral],
		});
	}

	function getHelpEmbed() {
		const helpMenu = createEmbed();

		helpMenu.setTitle('All Commands');
		const fields = [] as { name: string; value: string; inline: boolean }[];

		const cmds = Array.from(commands.values())
			.filter((cmd) => cmd instanceof CommandGroup || cmd.isChatInputCommand() || cmd.isSubCommand())
			.map((cmd) => (cmd instanceof CommandGroup ? Object.values(cmd.subcommands) : cmd))
			.flat()
			.sort((a, b) => a.displayName.localeCompare(b.displayName));

		cmds.forEach((command) => {
			fields.push({
				name: '/' + command.displayName,
				value: '-# ' + command.description,
				inline: true,
			});
		});

		const remainder = fields.length % 3;
		if (remainder) {
			const fill = 3 - remainder;
			for (let i = 0; i < fill; i++) {
				fields.push({ name: '\u200b', value: '\u200b', inline: true });
			}
		}

		helpMenu.addFields(fields.slice(0, 25));

		helpMenu.setFooter({
			text: `\nYou can send "/help [command name]" to get info on a specific command!`,
		});
		return helpMenu;
	}
};

async function commandAutocomplete({
	interaction,
	commands,
}: DiscordPlatformContext<AutocompleteInteraction, undefined>) {
	if (interaction.responded) return;

	const option = interaction.options.getFocused(true);
	if (!option || option.name !== 'command') return;

	const searchString = option.value.replace(/[^a-zA-Z0-9-]/g, '') || undefined;

	const defaultResponse = [{ name: '/stats', value: 'stats' }];

	if (!searchString) {
		interaction.respond(defaultResponse);
		return;
	}

	const results = await getCommandOptions(searchString);

	if (!results) {
		interaction.respond(defaultResponse);
		return;
	}

	interaction.respond(results);

	async function getCommandOptions(commandName: string) {
		commandName = commandName.toLowerCase().replace('/', '').trim();

		const matchIndex = (str: string) => str.toLowerCase().indexOf(commandName);

		const results = Array.from(commands.values())
			.filter((cmd) => cmd instanceof CommandGroup || cmd.isChatInputCommand() || cmd.isSubCommand())
			.map((cmd) => (cmd instanceof CommandGroup ? Object.values(cmd.subcommands) : cmd))
			.flat()
			.map((cmd) => cmd.displayName)
			.filter((name) => name.includes(commandName) || name.toLowerCase().includes(commandName))
			.sort((a, b) => matchIndex(a) - matchIndex(b))
			.slice(0, 5);

		return results?.map((name) => ({
			name: '/' + name,
			value: name.replaceAll(' ', '_'),
		}));
	}
}
