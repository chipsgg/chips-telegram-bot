class PlatformContext {
	/**
	 * @param {import('../sdk').SDK} sdk
	 * @param {import('../commands').ChipsCommand} command
	 */
	constructor(sdk, command) {
		/** @type {import('../sdk').SDK} */
		this.sdk = sdk;
		/** @type {import('../commands').ChipsCommand} */
		this.command = command;
		/** @type {any} */
		this.processed = undefined;
	}

	/**
	 * Respond to the user with an error message
	 * @param {Object} options
	 * @param {string} options.title Error title
	 * @param {string} options.message Error message
	 */
	error({ title, message }) {
		throw new Error('Not implemented');
	}

	getOption(name) {
		throw new Error('Not implemented');
	}
}

module.exports = PlatformContext;
