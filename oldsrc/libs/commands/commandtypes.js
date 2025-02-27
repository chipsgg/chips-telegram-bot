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
