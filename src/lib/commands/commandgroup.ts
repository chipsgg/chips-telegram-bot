import {
	BaseInteraction,
	PermissionsBitField,
	type RESTPostAPIApplicationCommandsJSONBody,
	SlashCommandBuilder,
	type SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { ChipsCommand, CommandAccess, CommandType, type GroupCommand } from './index.js';

export class CommandGroup<T = unknown> implements GroupCommand<T> {
	declare disabled: boolean;
	declare name: string;
	declare description: string;
	declare access: CommandAccess[];
	declare permissions?: bigint;
	declare type: CommandType.Group;
	declare fetchSettings?: boolean | undefined;
	declare adminRoleOverride?: boolean | undefined;

	declare slash: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

	private declare selfExecute: (interaction: BaseInteraction, ...args: unknown[]) => T;
	declare subcommands: Record<string, ChipsCommand>;

	constructor(settings: GroupCommand<T>) {
		this.disabled = settings.disabled ?? false;
		this.name = settings.name;
		this.description = settings.description;
		this.fetchSettings = settings.fetchSettings ?? false;

		this.access = settings.access instanceof Array ? settings.access : [settings.access];
		this.type = CommandType.Group;
		this.permissions = settings.permissions;
		this.adminRoleOverride = settings.adminRoleOverride;

		this.slash = settings.slash ?? new SlashCommandBuilder().setName(this.name);
		// .setDescription(this.description);

		// this.selfExecute = settings.process ?? (() => undefined);
		this.subcommands = {};
	}

	// public process(interaction: BaseInteraction, ...args: unknown[]) {
	// 	if (!interaction.isChatInputCommand()) {
	// 		return this.selfExecute(interaction, ...args);
	// 	}

	// 	const category = interaction.options.getSubcommand() ?? '';

	// 	if (!category) {
	// 		return this.selfExecute(interaction, ...args);
	// 	}

	// 	this.subcommands[category]?.process(interaction, ...args);
	// }

	// public autocomplete(interaction: Interaction, ...args: unknown[]) {
	// 	if (!interaction.isAutocomplete()) {
	// 		return this.selfExecute(interaction, ...args);
	// 	}

	// 	const category = interaction.options.getSubcommand() ?? '';

	// 	const auto = this.subcommands[category]?.getAutocomplete(interaction);
	// 	auto?.(interaction);
	// 	return;
	// }

	// public addSubcommand(subCommand: ChipsCommand) {
	// 	if (!subCommand.isSubCommand() || !(subCommand.slash instanceof SlashCommandSubcommandBuilder)) {
	// 		return;
	// 	}

	// 	if (!this.subcommands[subCommand.name]) {
	// 		this.subcommands[subCommand.name] = subCommand;
	// 		this.slash.addSubcommand(() => subCommand.slash as SlashCommandSubcommandBuilder);
	// 		subCommand.setParent(this);
	// 	}
	// }

	public getCommandJSON(): RESTPostAPIApplicationCommandsJSONBody | undefined {
		this.slash ??= new SlashCommandBuilder();

		if (!this.slash.name) {
			this.slash.setName(this.name);
		}

		if ('setDescription' in this.slash && !this.slash.description) {
			this.slash.setDescription(this.description);
		}

		if (this.permissions) {
			this.slash.setDefaultMemberPermissions(PermissionsBitField.resolve(this.permissions));
		}

		ChipsCommand.setCommandAccess(this.slash, this.access);

		return this.slash.toJSON();
	}
}
