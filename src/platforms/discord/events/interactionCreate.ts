import {
	AutocompleteInteraction,
	ButtonInteraction,
	ChannelType,
	ChatInputCommandInteraction,
	CommandInteraction,
	ContextMenuCommandInteraction,
	Events,
	GuildMember,
	MessageFlags,
	StringSelectMenuInteraction,
	type Interaction,
} from 'discord.js';
import { CommandGroup, ChipsCommand, CommandAccess } from '../../../lib/commands/index.js';
import { DiscordPlatformContext } from '../context.js';
import type { SDK } from '../../../lib/sdk/sdk.js';

const settings = {
	event: Events.InteractionCreate,
	createExecutor: createExecutor,
};

export default settings;

function createExecutor(sdk: SDK, commands: Map<string, ChipsCommand | CommandGroup>) {	
	async function execute(interaction: Interaction) {
		if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
			return OnCommandInteraction(interaction);
		}
		if (interaction.isButton() || interaction.isStringSelectMenu()) {
			return OnButtonInteraction(interaction);
		}
		if (interaction.isAutocomplete()) return OnAutocompleteInteraction(interaction);
	}
	
	async function OnCommandInteraction(interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction) {
		const command = GetCommand(interaction.commandName);
		if (command instanceof ChipsCommand) {
			if (command.isChatInputCommand() && !interaction.isChatInputCommand()) return;
			if (command.isContextMenuCommand() && !interaction.isContextMenuCommand()) return;
		} else {
			console.error('Command groups not supported yet.');
			return;
		}
	
		if (!command) return;

		if (command.disabled) {
			await interaction
				.reply({
					content: 'This command is currently disabled!',
					flags: [MessageFlags.Ephemeral],
				})
				.catch(() => undefined);
			return;
		}
	
		const hasPerms = await HasPermsAndAccess(command, interaction);
		if (!hasPerms) return;
	
		try {
			const ctx = new DiscordPlatformContext(sdk, command, interaction);
	
			ctx.processed = await command.process?.(ctx);
			await command.handlers?.discord?.(ctx);
		} catch (error) {
			console.error(error);
			await interaction
				.reply({
					content: 'There was an error while executing this command!',
					flags: [MessageFlags.Ephemeral],
				})
				.catch(() => undefined);
		}
	}
	
	async function OnButtonInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
		const args = interaction.customId.split('|');
		const commandName = args[0];
	
		const command = GetCommand(commandName);
		if (!command || command instanceof CommandGroup || !command.isButtonCommand()) return;
	
		const hasPerms = await HasPermsAndAccess(command, interaction);
		if (!hasPerms) return;

		if (command.disabled) {
			await interaction
				.reply({
					content: 'This command is currently disabled!',
					flags: [MessageFlags.Ephemeral],
				})
				.catch(() => undefined);
			return;
		}
	
		try {
			const ctx = new DiscordPlatformContext(sdk, command, interaction);
	
			ctx.processed = await command.process?.(ctx);
			await command.handlers?.discord?.(ctx);
		} catch (_) {
			await interaction
				.reply({
					content: 'There was an error while executing this command!',
					flags: [MessageFlags.Ephemeral],
				})
				.catch(() => undefined);
		}
	}
	
	async function OnAutocompleteInteraction(interaction: AutocompleteInteraction) {
		if (interaction.responded) return;
	
		const command = GetCommand(interaction.commandName);
		if (!command || command instanceof CommandGroup) return;
		
		if (command.disabled) return;
	
		try {
			const ctx = new DiscordPlatformContext(sdk, command, interaction);

			const auto = command.getAutocomplete(interaction);
			await auto?.(ctx);
		} catch (error) {
			console.log(error);
		}
	}
	
	function GetCommand(name: string): ChipsCommand | CommandGroup | undefined {
		return commands.get(name);
	}

	return execute;
}

async function HasPermsAndAccess(
	command: ChipsCommand | CommandGroup,
	interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
) {
	if (interaction.channel && !isValidAccess(command.access, interaction.channel.type)) return false;

	if (!interaction.guildId || !command.permissions || !(interaction.member instanceof GuildMember)) return true;

	// Get user permissions
	const perms = interaction.memberPermissions;
	// Return if lacking one
	if (!perms || !perms.has(command.permissions)) {
		await interaction.reply({
			content: "You don't have the required permissions for this command.",
			allowedMentions: { repliedUser: true },
			flags: [MessageFlags.Ephemeral],
		});
		return false;
	}

	return true;
}

function isValidAccess(access: CommandAccess | CommandAccess[], type: ChannelType): boolean {
	const a = access instanceof Array ? access : [access];

	if (a.includes(CommandAccess.Everywhere)) return true;

	switch (type) {
		case ChannelType.DM:
		case ChannelType.GroupDM:
			return a.includes(CommandAccess.BotDM) || a.includes(CommandAccess.PrivateMessages);
		default:
			return a.includes(CommandAccess.Guild);
	}
}