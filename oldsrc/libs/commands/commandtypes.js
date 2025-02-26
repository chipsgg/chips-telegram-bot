const CommandType = {
	Slash: 0,
	GuildSlash: 1,
	Button: 2,
	Combo: 3,
	Group: 4,
	Autocomplete: 5,
	UserContextMenu: 6,
	MessageContextMenu: 7,
};

const CommandAccess = {
	Everywhere: 0,
	Guild: 1,
	BotDm: 2,
	PrivateMessages: 3,
};

const SlashCommandOptionType = {
	Boolean: 0,
	Integer: 1,
	Number: 2,
	User: 3,
	Channel: 4,
	Role: 5,
	Attachment: 6,
	Mentionable: 7,
	String: 8,
};

module.exports = {
	CommandType,
	CommandAccess,
	SlashCommandOptionType,
};

/**
 * @import { AutocompleteInteraction, ContextMenuCommandBuilder } from 'discord.js';
 */

/**
 * @typedef {Object} PlatformHandlers
 * @property {Function} discord
 * @property {Function} telegram
 */

/**
 * @typedef {Object} CommandBase
 * @property {string} name
 * @property {string} description
 * @property {boolean} [fetchSettings]
 * @property {Function} process
 * @property {PlatformHandlers} [handlers]
 * @property {bigint} [permissions]
 * @property {boolean} [adminRoleOverride]
 * @property {0 | 1 | 2 | 3 | number[]} access
 * @property {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7} type
 */

/**
 * @typedef {Object} SlashCommandBase
 * @extends CommandBase
 * @property {0 | 1 | 3} type
 * @property {Record<string, ChipsSlashCommandOption>} [options]
 */

/**
 * @typedef {Object} SlashCommand
 * @extends SlashCommandBase
 * @property {false} [subCommand]
 * @property {SlashCommandBuilder} [slash]
 * @property {Record<string, ChipsSlashCommandOption>} [options]
 */

/**
 * @typedef {Object} ButtonCommand
 * @extends CommandBase
 * @property {2} type
 * @property {Record<string, ChipsSlashCommandOption>} [options]
 */

/**
 * @typedef {Object} ContextMenuCommand
 * @extends CommandBase
 * @property {6 | 7} type
 * @property {import('discord.js).ContextMenuCommandBuilder} [slash]
 */

/**
 * @typedef {SlashCommand | ButtonCommand | ContextMenuCommand} ChipsCommandConfig
 * @property {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7} type
 */

/**
 * @typedef {(interaction: AutocompleteInteraction) => Promise<void>} AutocompleteHandler
 */

/** @import {
	SlashCommandAttachmentOption,
	SlashCommandBooleanOption,
	SlashCommandChannelOption,
	SlashCommandIntegerOption,
	SlashCommandMentionableOption,
	SlashCommandNumberOption,
	SlashCommandRoleOption,
	SlashCommandStringOption,
	SlashCommandUserOption,
} from 'discord.js' */

/**
 * @typedef {Object} ChipsCommandOption
 * @property {string} name
 * @property {string} description
 * @property {boolean} [required]
 * @property {string} [alternative]
 */

/**
 * @typedef {ChipsCommandOption & { type: 1, builder?: (builder: SlashCommandIntegerOption) => SlashCommandIntegerOption, autocomplete?: AutocompleteHandler }} ChipsSlashCommandOptionInteger
 * @typedef {ChipsCommandOption & { type: 2, builder?: (builder: SlashCommandNumberOption) => SlashCommandNumberOption, autocomplete?: AutocompleteHandler }} ChipsSlashCommandOptionNumber
 * @typedef {ChipsCommandOption & { type: 3, builder?: (builder: SlashCommandStringOption) => SlashCommandStringOption, autocomplete?: AutocompleteHandler }} ChipsSlashCommandOptionString
 * @typedef {ChipsCommandOption & { type: 0, builder?: (builder: SlashCommandBooleanOption) => SlashCommandBooleanOption }} ChipsSlashCommandOptionBoolean
 * @typedef {ChipsCommandOption & { type: 3, builder?: (builder: SlashCommandUserOption) => SlashCommandUserOption }} ChipsSlashCommandOptionUser
 * @typedef {ChipsCommandOption & { type: 4, builder?: (builder: SlashCommandChannelOption) => SlashCommandChannelOption }} ChipsSlashCommandOptionChannel
 * @typedef {ChipsCommandOption & { type: 5, builder?: (builder: SlashCommandRoleOption) => SlashCommandRoleOption }} ChipsSlashCommandOptionRole
 * @typedef {ChipsCommandOption & { type: 6, builder?: (builder: SlashCommandAttachmentOption) => SlashCommandAttachmentOption }} ChipsSlashCommandOptionAttachment
 * @typedef {ChipsCommandOption & { type: 7, builder?: (builder: SlashCommandMentionableOption) => SlashCommandMentionableOption }} ChipsSlashCommandOptionMentionable
 */

/**
 * @typedef {ChipsSlashCommandOptionInteger | ChipsSlashCommandOptionNumber | ChipsSlashCommandOptionString | ChipsSlashCommandOptionBoolean | ChipsSlashCommandOptionUser | ChipsSlashCommandOptionChannel | ChipsSlashCommandOptionRole | ChipsSlashCommandOptionAttachment | ChipsSlashCommandOptionMentionable} ChipsSlashCommandOption
 */
