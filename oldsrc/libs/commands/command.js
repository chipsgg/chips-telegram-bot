/**
 * @typedef CommandCreationOptions
 * @property {string} name
 * @property {string} description
 * @property {string} usage
 * @property {Record<string, CommandOption>} options
 */

/**
 * @typedef DiscordCommandOptions
 * @property {string} name
 * @property {string} description
 *
 */

/**
 * @typedef CommandOption
 * @property {string} description
 * @property {string} type
 */

/** @import { AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder } from 'discord.js' */
/** @import { ChipsCommandConfig, ChipsSlashCommandOption, CommandBase } from './commandtypes' */

const {
	ApplicationCommandType,
	ApplicationIntegrationType,
	ContextMenuCommandBuilder,
	InteractionContextType,
	PermissionsBitField,
	SlashCommandBuilder,
} = require('discord.js');

const { CommandAccess, CommandType, SlashCommandOptionType } = require('./index');

/**
 * @implements CommandBase
 * @constructor
 * @param {ChipsCommandConfig} settings
 */
class ChipsCommand {
	get displayName() {
		return this.name;
	}

	/**
	 * @param {ChipsCommandConfig} settings
	 */
	constructor(settings) {
		this.name = settings.name;
		this.description = settings.description;
		this.fetchSettings = settings.fetchSettings ?? false;

		this.access = settings.access instanceof Array ? settings.access : [settings.access];
		this.type = settings.type;
		this.permissions = settings.permissions;
		this.adminRoleOverride = settings.adminRoleOverride;

		this.process = settings.process;
		this.handlers = settings.handlers;

		if ('slash' in settings && settings.slash instanceof SlashCommandBuilder) {
			this.slash = settings.slash;
		}

		if ('subCommand' in settings) {
			this.subCommand = settings.subCommand ?? false;
		} else {
			this.subCommand = false;
		}

		if ('options' in settings) {
			this.options = settings.options;
		}

		this.buildSlashCommand();
	}

	/**
	 * @param {AutocompleteInteraction} interaction
	 */
	getAutocomplete(interaction) {
		const focused = interaction.options.getFocused(true);
		if (!focused) undefined;

		return this.options?.[focused.name]?.autocomplete;
	}

	isChatInputCommand() {
		return this.type === CommandType.Slash || this.type === CommandType.GuildSlash || this.type === CommandType.Combo;
	}

	isContextMenuCommand() {
		return this.type === CommandType.UserContextMenu || this.type === CommandType.MessageContextMenu;
	}

	isButtonCommand() {
		return this.type === CommandType.Button;
	}

	/**
	 * @this {ChipsCommand}
	 */
	buildSlashCommand() {
		if (this.isChatInputCommand()) {
			this.#buildChatSlashCommand();
			return this.slash;
		}

		if (this.isContextMenuCommand()) {
			this.#buildContextMenuCommand();
			return this.slash;
		}

		if (!this.slash) return undefined;

		return undefined;
	}

	#buildChatSlashCommand() {
		if (!this.isChatInputCommand()) return;

		this.slash ??= new SlashCommandBuilder();
		this.slash.setName(this.name).setDescription(this.description);

		ChipsCommand.setCommandAccess(this.slash, this.access);

		if (this.permissions) {
			this.slash.setDefaultMemberPermissions(PermissionsBitField.resolve(this.permissions));
		}

		for (const option in this.options) {
			const opt = this.options?.[option];
			if (!opt) continue;
			this.#buildSlashCommandOption(opt);
		}
	}

	/**
	 * @param {ChipsSlashCommandOption} option
	 */
	#buildSlashCommandOption(option) {
		if (!this.isChatInputCommand() || !this.slash) return;

		switch (option.type) {
			case SlashCommandOptionType.String:
				this.slash.addStringOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					if ('autocomplete' in option) opt.setAutocomplete(true);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Integer:
				this.slash.addIntegerOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					if ('autocomplete' in option) opt.setAutocomplete(true);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Number:
				this.slash.addNumberOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					if ('autocomplete' in option) opt.setAutocomplete(true);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Boolean:
				this.slash.addBooleanOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.User:
				this.slash.addUserOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Channel:
				this.slash.addChannelOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Role:
				this.slash.addRoleOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Mentionable:
				this.slash.addMentionableOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			case SlashCommandOptionType.Attachment:
				this.slash.addAttachmentOption((opt) => {
					setNameAndDescription(opt, option);
					opt.setRequired(option.required ?? false);
					option.builder?.(opt);
					return opt;
				});
				break;
			default:
				break;
		}

		/**
		 * @param {import('discord.js').SharedNameAndDescription} builder
		 * @param {ChipsSlashCommandOption} option
		 * @returns {any}
		 */
		function setNameAndDescription(builder, option) {
			return builder.setName(option.name).setDescription(option.description);
		}
	}

	#buildContextMenuCommand() {
		if (!this.isContextMenuCommand()) return;

		this.slash ??= new ContextMenuCommandBuilder();
		const type =
			this.type === CommandType.UserContextMenu ? ApplicationCommandType.User : ApplicationCommandType.Message;

		this.slash.setName(this.name).setType(type);

		ChipsCommand.setCommandAccess(this.slash, this.access);

		if (this.permissions) {
			this.slash.setDefaultMemberPermissions(PermissionsBitField.resolve(this.permissions));
		}
	}

	/**
	 * @param {SlashCommandBuilder | ContextMenuCommandBuilder | SlashCommandSubcommandsOnlyBuilder} slash
	 * @param {CommandAccess[keyof CommandAccess][]} access
	 */
	static setCommandAccess(slash, access) {
		for (const a of access) {
			switch (a) {
				case CommandAccess.Everywhere:
					slash.setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall);
					slash.setContexts(
						InteractionContextType.Guild,
						InteractionContextType.BotDM,
						InteractionContextType.PrivateChannel,
					);
					break;
				case CommandAccess.Guild:
					slash.setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ...(slash.integration_types ?? []));
					slash.setContexts(InteractionContextType.Guild, ...(slash.contexts ?? []));
					break;
				case CommandAccess.BotDM:
					slash.setContexts(InteractionContextType.BotDM, ...(slash.contexts ?? []));
					break;
				case CommandAccess.PrivateMessages:
					slash.setContexts(InteractionContextType.PrivateChannel, ...(slash.contexts ?? []));
					slash.setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ...(slash.integration_types ?? []));
					break;
				default:
					break;
			}
		}
	}

	toJSON() {
		return this.slash?.toJSON();
	}

	getUsage(includeName = true) {
		const commandString = `**/${this.name}** - ${this.description}`;
		const options = Object.values(this.options ?? {});

		if (!options.length) return includeName ? commandString : 'Usage information not available.';

		const optionsString = options
			.map((option) => {
				return (
					'-# ' +
					(option.required ? `\`${option.name}\`` : `(\`${option.name}\`)`) +
					' - ' +
					option.description +
					(option.alternative ? `\n-# (${option.alternative})` : '')
				);
			})
			.join('\n');

		return includeName ? `${commandString}\n${optionsString}` : optionsString;
	}
}

const getAutocomplete = getAutocompleteFunction;

/**
 * @param {ChipsCommand} cmd
 * @param {AutocompleteInteraction} interaction
 * @returns {Promise<undefined | AutocompleteInteraction>}
 */
async function getAutocompleteFunction(cmd, interaction) {
	const auto = cmd.getAutocomplete(interaction);
	if (!auto) return undefined;

	return auto;
}

module.exports = {
	getAutocomplete,
	getAutocompleteFunction,
	ChipsCommand,
};
