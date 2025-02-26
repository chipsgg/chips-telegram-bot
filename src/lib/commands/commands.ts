import {
	Client,
	ContextMenuCommandBuilder,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
	type SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { ChipsCommand } from './command.ts';
import type { ChipsSlashCommandOption } from './index.ts';
import type { DiscordPlatformContext, IPlatformContext } from '../../platforms/context.ts';

export interface PlatformContextHandlers<T> {
	discord?: (ctx: DiscordPlatformContext<T>) => Promise<void> | void;
	telegram?: (ctx: IPlatformContext<T>) => Promise<void> | void;
}

export interface CommandBase<T = undefined> {
	name: string;
	description: string;
	fetchSettings?: boolean;
	process?: (ctx: IPlatformContext<T>) => Promise<T> | T;
	handlers: PlatformContextHandlers<T>;

	permissions?: bigint;
	adminRoleOverride?: boolean;
	access: CommandAccess | CommandAccess[];
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

export type Command<T = undefined> = SlashCommand<T> | ContextMenuCommand<T> | GroupCommand<T> | ButtonCommand<T> | SubCommand<T>;

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
