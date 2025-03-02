import type { ChipsCommand } from '../../lib/commands/command.js';
import type { CommandGroup } from '../../lib/commands/commandgroup.js';

export default async function initializeTelegram(_commands: Map<string, ChipsCommand | CommandGroup>): Promise<void> {
	console.log('[TELEGRAM] Telegram bot not implemented yet!');
}
