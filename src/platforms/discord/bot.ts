import {
	Client,
	Events,
	GatewayIntentBits,
	type ClientEvents,
	type RESTPostAPIApplicationCommandsJSONBody,
	type RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';
import dotenv from 'dotenv';
import { ChipsCommand, CommandGroup, registerFiles } from '../../lib/commands/index.js';
import type { SDK } from '../../lib/sdk/sdk.js';
import { DiscordPlatformContext } from './context.js';

dotenv.config();

export default async function initializeDiscord(sdk: SDK, commands: Map<string, ChipsCommand | CommandGroup>): Promise<Client> {
	const client = new Client({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.GuildIntegrations,
			GatewayIntentBits.GuildMessageReactions,
			GatewayIntentBits.MessageContent,
		],
	});

	const filter = (fileName: string) => fileName.endsWith('.ts') || fileName.endsWith('.js');

	DiscordPlatformContext.commands = commands;

	console.log('[DISCORD] Registering events...');

	await registerFiles<{
		event: keyof ClientEvents;
		createExecutor: (sdk: SDK, commands: Map<string, ChipsCommand | CommandGroup>) => Parameters<typeof client.on<keyof ClientEvents>>[1];
	}>('events', 1, filter, (event) => {
		client.on(event.event, event.createExecutor(sdk, commands));
	}, './src/platforms/discord/', '../../platforms/discord/');

	console.log('[DISCORD] Events registered!');

	const deploying = process.argv.some((arg) => arg.includes('deploy'));

	client.once(Events.ClientReady, async () => {
		console.log('[DISCORD] Bot Ready!');

		const discordCommands = Array.from(commands.values())
			.filter((command) => !command.disabled)
			.map(getCommandJSON)
			.filter((json) => json) as RESTPostAPIApplicationCommandsJSONBody[];

		await client.application?.commands.fetch();

		// Deploy commands if they don't exist or if there's more/less commands than expected
		// Subsequent deploys are handled by the deploy script
		if (client.application?.commands.cache.size !== discordCommands.length) {
			await client.application?.commands.set(discordCommands);
			console.log(`[DISCORD] Deployed ${discordCommands.length} commands`);
			return;
		}

		for (const command of discordCommands) {
			const existing = client.application?.commands.cache.find((c) => c.name === command.name);
			if (!existing) {
				await client.application?.commands.set(discordCommands);
				console.log(`[DISCORD] Deployed ${discordCommands.length} commands`);
				return;
			}
		}
	});

	if (!deploying) {
		client.login(process.env.BOT_TOKEN);
	}

	return client;
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
