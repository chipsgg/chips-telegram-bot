import dotenv from 'dotenv';
import { initializeSdk } from './lib/sdk/sdk.js';
import initializeDiscord from './platforms/discord/bot.js';
import { loadCommands } from './platforms/loadcommands.js';
import initializeTelegram from './platforms/telegram/bot.js';
import { initializeExpress } from './web.js';
dotenv.config();

console.log('Starting...');

export const commands = await loadCommands();

console.log('Loaded ' + commands.size + ' commands');

export const sdk = await initializeSdk(process.env.CHIPS_TOKEN);

if (process.env.DISCORD_TOKEN) {
	await initializeDiscord(sdk, commands);
} else {
	console.log('[DISCORD] No Discord token provided! Skipping Discord initialization.');
}

if (process.env.TELEGRAM_TOKEN) {
	await initializeTelegram(commands);
} else {
	console.log('[TELEGRAM] No Telegram token provided! Skipping Telegram initialization.');
}

await initializeExpress(commands);
