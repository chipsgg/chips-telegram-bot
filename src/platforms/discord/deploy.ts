import {
	REST,
	Routes,
	type RESTGetAPIApplicationCommandsResult,
	type RESTPostAPIApplicationCommandsJSONBody,
	type RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';
import dotenv from 'dotenv';
import { ChipsCommand, CommandGroup } from '../../lib/commands/index.ts';
import { loadCommands } from '../../platforms/loadcommands.ts';
dotenv.config();

/*
 *  ===================================================================
 *	Command arguments on startup of script to do one-time operations
 *
 *		"deploy global" 	 - updates slash commands globally
 *		[REMOVED] "deploy <server id>" - updates slash commands in that server
 *		Append "clear" to remove slash commands from a server
 *  ===================================================================
 */

export async function deploySlashCommands() {
	const commands = await loadCommands();
	const proccessArgs = process.argv.slice(1);

	const rest = new REST().setToken(process.env.DISCORD_TOKEN);

	const json = Array.from(commands.values())
		.map(getCommandJSON)
		.filter((json) => json) as RESTPostAPIApplicationCommandsJSONBody[];

	if (proccessArgs[1] === 'global') {
		await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
			body: json,
		});
		console.log(`[DISCORD] Updated ${json.length} slash commands globally`);
	} else if (proccessArgs[1] === 'single') {
		const name = proccessArgs[2];
		const command = json.find((cmd) => cmd.name === name);

		const existingCommands = (await rest.get(
			Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
		)) as RESTGetAPIApplicationCommandsResult;

		setTimeout(async function () {
			const existing = existingCommands?.find((cmd) => cmd.name === name);

			if (!command && existing) {
				await rest.delete(Routes.applicationCommand(process.env.DISCORD_CLIENT_ID, existing.id));
				console.log(`[DISCORD] Deleted slash command "${name}" globally`);
				return;
			} else if (!command) {
				console.log('[DISCORD] Could not find command with the name "' + name + '"');
				return;
			}

			if (!existing) {
				await rest.post(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
					body: command,
				});
				console.log('[DISCORD] Created that slash command globally');
			} else {
				await rest.patch(Routes.applicationCommand(process.env.DISCORD_CLIENT_ID, existing.id), { body: command });
				console.log('[DISCORD] Updated that slash command globally');
			}
		}, 3000);
	} else {
		console.log('[DISCORD] Invalid deploy arguments, please use "global" or "single <command name>"');
	}

	function getCommandJSON(
		command?: ChipsCommand | CommandGroup,
	): RESTPostAPIApplicationCommandsJSONBody | RESTPostAPIContextMenuApplicationCommandsJSONBody | undefined {
		if (!command) return;

		if (command instanceof CommandGroup) {
			return command.getCommandJSON();
		}

		if (command.isContextMenuCommand()) {
			const json = command.toJSON();
			return json as RESTPostAPIContextMenuApplicationCommandsJSONBody;
		}

		if (command.isChatInputCommand() && !command.isSubCommand() && command.slash) {
			const json = command.toJSON();
			return json as RESTPostAPIApplicationCommandsJSONBody;
		}
	}
}
