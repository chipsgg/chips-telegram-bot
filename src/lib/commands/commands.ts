import {
	BaseInteraction,
	Client,
	ContextMenuCommandBuilder,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
	type SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import type { DiscordPlatformContext, IPlatformContext } from '../../platforms/context.js';
import { ChipsCommand } from './command.js';
import type { ChipsSlashCommandOption } from './index.js';

export interface PlatformContextHandlers<T> {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	discord?: (ctx: DiscordPlatformContext<BaseInteraction, T>) => any;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	telegram?: (ctx: IPlatformContext<T>) => any;
}

export interface CommandBase<T = undefined> {
	name: string;
	description: string;
	fetchSettings?: boolean;
	process?: T extends undefined ? undefined : (ctx: IPlatformContext<T>) => Promise<T> | T;
	handlers?: PlatformContextHandlers<T>;

	permissions?: bigint;
	adminRoleOverride?: boolean;
	access: CommandAccess | CommandAccess[];

	disabled?: boolean;
}

interface SlashCommandBase<T = undefined> extends CommandBase<T> {
	type: CommandType.Slash | CommandType.GuildSlash | CommandType.Combo;
	options?: Record<string, ChipsSlashCommandOption>;
}

export interface SlashCommand<T = undefined> extends SlashCommandBase<T> {
	subCommand?: false;
	slash?: SlashCommandBuilder;
	options?: Record<string, ChipsSlashCommandOption>;
}

export interface SubCommand<T = undefined> extends SlashCommandBase<T> {
	subCommand: true;
	slash?: SlashCommandSubcommandBuilder;
}

export interface ButtonCommand<T = undefined> extends CommandBase<T> {
	type: CommandType.Button;
	options?: Record<string, ChipsSlashCommandOption>;
}

export interface ContextMenuCommand<T = undefined> extends CommandBase<T> {
	type: CommandType.UserContextMenu | CommandType.MessageContextMenu;
	slash?: ContextMenuCommandBuilder;
}

export interface GroupCommand<T = undefined> extends CommandBase<T> {
	type: CommandType.Group;
	slash?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
	addSubcommand?: (subCommand: ChipsCommand<T>) => void;
}

export type Command<T = undefined> =
	| SlashCommand<T>
	| ContextMenuCommand<T>
	| GroupCommand<T>
	| ButtonCommand<T>
	| SubCommand<T>;

export enum CommandType {
	Slash,
	GuildSlash,
	Button,
	Combo,
	Group,
	Autocomplete,
	UserContextMenu,
	MessageContextMenu,
}

export enum CommandAccess {
	Everywhere,
	Guild,
	BotDM,
	PrivateMessages,
}

export interface CronTask {
	cron: string;
	process: (client: Client) => void;
}
