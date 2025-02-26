namespace NodeJS {
	interface ProcessEnv {
		HTTP_PORT: string;
		CHIPS_TOKEN: string;
		
		DISCORD_TOKEN: string;
		DISCORD_CLIENT_ID: string;
		TELEGRAM_TOKEN: string;

		ALERT_INTERVAL: string;
		ALERT_MINIMUM_DOLLAR: string;
		ALERT_MINIMUM_MULTIPLIER: string;
	}
}
