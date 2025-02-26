import type { ButtonInteraction, ChatInputCommandInteraction, ContextMenuCommandInteraction, StringSelectMenuInteraction } from "discord.js";
import type { SDK } from "../../lib/sdk/sdk.js";
import type { IPlatformContext } from "../context.js";
import type { ChipsCommand } from "../../lib/commands/command.js";

export class DiscordPlatformContext<T> implements IPlatformContext<T> {
	platform: "discord";
	sdk: SDK;
	command: ChipsCommand<T>;
	processed?: T;
	interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction | ButtonInteraction | StringSelectMenuInteraction;

	constructor(sdk: SDK, command: ChipsCommand<T>, interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction | ButtonInteraction | StringSelectMenuInteraction) {
		this.platform = "discord";
		this.sdk = sdk;
		this.command = command;
		this.interaction = interaction;
	}
}