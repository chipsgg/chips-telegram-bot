import dotenv from 'dotenv';
import { ChipsCommand, CommandGroup } from '../lib/commands/index.ts';
import { registerCommandGroups, registerFiles } from '../lib/commands/register.ts';
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
const proccessArgs = process.argv.slice(1);

export async function loadCommands() {
	const filter = (fileName: string) => fileName.endsWith('.ts') || fileName.endsWith('.js');

	await registerFiles<ChipsCommand>('features', 2, filter, (cmd) => {
		commands.set(cmd.name, cmd);
	});

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
