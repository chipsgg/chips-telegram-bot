import type { InteractionDeferReplyOptions, InteractionDeferUpdateOptions } from 'discord.js';
import type { ChipsCommand } from '../lib/commands/command.js';
import type { SDK } from '../lib/sdk/sdk.js';

export interface IPlatformContext<T> {
	platform: 'discord' | 'telegram';
	sdk: SDK;
	command: ChipsCommand<T>;
	processed?: T;
	// Specific to Discord, but helps here for process functions
	deferReply: (options?: InteractionDeferReplyOptions) => Promise<void>;
	deferUpdate: (options?: InteractionDeferUpdateOptions) => Promise<void>;
}

export * from './discord/context.js';
export * from './telegram/context.js';
