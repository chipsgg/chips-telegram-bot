import {
	type BaseInteraction,
	EmbedBuilder,
	type InteractionDeferReplyOptions,
	type InteractionDeferUpdateOptions,
} from 'discord.js';
import type { ChipsCommand, CommandGroup } from '../../lib/commands/index.js';
import type { SDK } from '../../lib/sdk/sdk.js';
import type { IPlatformContext } from '../context.js';

export class DiscordPlatformContext<I extends BaseInteraction, T> implements IPlatformContext<T> {
	platform: 'discord';
	sdk: SDK;
	command: ChipsCommand<T>;
	processed?: T;
	interaction: I;
	static commands: Map<string, ChipsCommand | CommandGroup>;

	get commands() {
		return DiscordPlatformContext.commands;
	}

	constructor(sdk: SDK, command: ChipsCommand<T>, interaction: I) {
		this.platform = 'discord';
		this.sdk = sdk;
		this.command = command;
		this.interaction = interaction;
	}

	async deferReply(options?: InteractionDeferReplyOptions) {
		if (
			(this.interaction && this.interaction.isCommand()) ||
			this.interaction.isMessageComponent() ||
			this.interaction.isButton()
		) {
			await this.interaction.deferReply(options);
		}
	}

	async deferUpdate(options?: InteractionDeferUpdateOptions) {
		if ((this.interaction && this.interaction.isMessageComponent()) || this.interaction.isButton()) {
			await this.interaction.deferUpdate(options);
		}
	}

	createEmbed() {
		return DiscordPlatformContext.createEmbed();
	}

	static createEmbed() {
		const embed = new EmbedBuilder();
		embed.setColor('#d2ceaf');

		embed.setFooter({
			text: 'Powered by Chips.gg',
			iconURL: 'https://cdn.chips.gg/public/images/assets/favicon/favicon-32x32.png',
		});

		return embed;
	}
}
