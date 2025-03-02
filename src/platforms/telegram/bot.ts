import type { ChipsCommand } from '../../lib/commands/command.ts';
import type { CommandGroup } from '../../lib/commands/commandgroup.ts';

export default async function initializeTelegram(commands: Map<string, ChipsCommand | CommandGroup>): Promise<void> {
	console.log('[TELEGRAM] Telegram bot not implemented yet!');
}
