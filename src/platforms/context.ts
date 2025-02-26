import type { ChipsCommand } from "../lib/commands/command.js";
import type { SDK } from "../lib/sdk/sdk.js";

export interface IPlatformContext<T> {
	platform: 'discord' | 'telegram';
	sdk: SDK;
	command: ChipsCommand<T>;
	processed?: T;
}

export * from './discord/context.js';
export * from './telegram/context.js';