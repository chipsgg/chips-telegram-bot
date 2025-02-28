import dotenv from 'dotenv';
import { ChipsCommand, CommandGroup } from '../lib/commands/index.js';
import { registerFeatures } from '../lib/commands/register.js';
dotenv.config();

/*
 *  ===================================================================
 *	Command arguments on startup of script to do one-time operations
 *
 *		"deploy global" 	 - updates slash commands globally
 *		Append "clear" to remove slash commands from a server
 *  ===================================================================
 */

const commands = new Map<string, ChipsCommand | CommandGroup>();

export async function loadCommands() {
	const filter = (fileName: string) => fileName.endsWith('.ts') || fileName.endsWith('.js');

	await registerFeatures<ChipsCommand>('features', filter, (cmd) => {
		commands.set(cmd.name, cmd);
	}, 2);

	// const subFilter = (fileName: string) => filter(fileName) && !fileName.includes('command');

	// await registerCommandGroups('commands', 2, async (folder, group) => {
	// 	const command = new CommandGroup(group);

	// 	await registerFiles<ChipsCommand>(folder, subFilter, (cmd) => {
	// 		command.addSubcommand(cmd);
	// 		console.log('Loaded subcommand: ' + cmd.name);
	// 	});

	// 	commands.set(command.name, command);
	// });

	return commands;
}
