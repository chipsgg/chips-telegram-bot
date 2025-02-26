import { deploySlashCommands } from './platforms/discord/deploy.ts';

// This file is run from the command line to deploy the slash commands

if (process.argv[1] === 'deploy') {
	await deploySlashCommands();
}
