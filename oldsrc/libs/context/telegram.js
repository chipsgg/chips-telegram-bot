const PlatformContext = require('./context');

class DiscordContext extends PlatformContext {
	/**
	 * @param {import('../sdk').SDK} sdk
	 * @param {import('../commands').ChipsCommand} command
	 * @param {import('discord.js').Client} client
	 * @param {import('discord.js').Interaction} interaction
	 */
	constructor(sdk, command, client, interaction) {
		super(sdk, command);

		/** @type {import('discord.js').Client} */
		this.client = client;

		/** @type {import('discord.js').Interaction} */
		this.interaction = interaction;
	}

	/**
	 * @inheritdoc
	 * @param {{ title: string; message: string; }} options
	 */
	error(options) {
		if (this.interaction.isAutocomplete()) return;

		const payload = {
			content: `## ${options.title}\n${options.message}`,
		};

		if (this.interaction.deferred) {
			return this.interaction.editReply(payload);
		}

		if (this.interaction.replied) {
			return this.interaction.followUp({
				...payload,
				ephemeral: true,
			});
		}

		this.interaction.reply({
			...payload,
			ephemeral: true,
		});
	}
}

module.exports = DiscordContext;
