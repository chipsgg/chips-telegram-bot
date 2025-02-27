import {
	AutocompleteInteraction,
	SlashCommandAttachmentOption,
	SlashCommandBooleanOption,
	SlashCommandChannelOption,
	SlashCommandIntegerOption,
	SlashCommandMentionableOption,
	SlashCommandNumberOption,
	SlashCommandRoleOption,
	SlashCommandStringOption,
	SlashCommandUserOption,
} from 'discord.js';
import type { DiscordPlatformContext } from '../../platforms/context.js';

export type AutocompleteHandler = (ctx: DiscordPlatformContext<AutocompleteInteraction, undefined>) => Promise<void>;

export interface ChipsCommandOption {
	name: string;
	description: string;
	required?: boolean;
	alternative?: string;
}

export enum SlashCommandOptionType {
	Boolean,
	Integer,
	Number,
	User,
	Channel,
	Role,
	Attachment,
	Mentionable,
	String,
}

export type ChipsSlashCommandOption =
	| ChipsSlashCommandOptionType<SlashCommandOptionType.Integer, SlashCommandIntegerOption, true>
	| ChipsSlashCommandOptionType<SlashCommandOptionType.Number, SlashCommandNumberOption, true>
	| ChipsSlashCommandOptionType<SlashCommandOptionType.String, SlashCommandStringOption, true>
	| ChipsSlashCommandOptionType<SlashCommandOptionType.Boolean, SlashCommandBooleanOption>
	| ChipsSlashCommandOptionType<SlashCommandOptionType.User, SlashCommandUserOption>
	| ChipsSlashCommandOptionType<SlashCommandOptionType.Channel, SlashCommandChannelOption>
	| ChipsSlashCommandOptionType<SlashCommandOptionType.Role, SlashCommandRoleOption>
	| ChipsSlashCommandOptionType<SlashCommandOptionType.Attachment, SlashCommandAttachmentOption>
	| ChipsSlashCommandOptionType<SlashCommandOptionType.Mentionable, SlashCommandMentionableOption>;

type ChipsSlashCommandOptionType<Type, OptionType, Autocomplete = false> = ChipsCommandOption & {
	type: Type;
	builder?: (builder: OptionType) => OptionType;
	autocomplete?: Autocomplete extends true ? AutocompleteHandler : undefined;
};
