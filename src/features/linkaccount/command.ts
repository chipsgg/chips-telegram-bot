import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CommandType, ChipsCommand, CommandAccess, SlashCommandOptionType } from "../../lib/commands/index.js";

const command = new ChipsCommand({
	name: 'link',
	description: 'Link your account to Chips.gg!',
	type: CommandType.Slash,
	access: CommandAccess.Everywhere,
	options: {
		username: {
			name: 'username',
			description: 'Your Chips.gg username',
			type: SlashCommandOptionType.String,
			required: true,
		},
		totp: {
			name: 'totp',
			description: 'Your Chips.gg TOTP code',
			type: SlashCommandOptionType.String,
			required: true,
			builder: (opt) => opt.setMaxLength(6).setMinLength(6),
		}
	}
});

export default command;

command.handlers.discord = async ({ sdk, interaction, platform, createEmbed }) => {
	if (!interaction.isChatInputCommand()) return;

	const username = interaction.options.getString('username', true);
	const totp = interaction.options.getString('totp', true);

	await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

	const payload = {
		platformid: interaction.user.id,
		platform: platform,
		userid: username,
		code: totp,
	};

	const linked = await sdk.auth('linkPlatformID', payload).catch(() => null);

	if (!linked) {
		return interaction.editReply({ content: 'Failed to link account!' });
	}

	// const [player, vip] = await Promise.all([
	// 	sdk.public('getUser', {
	// 		userid: linked.userid,
	// 	}),
	// 	sdk.public('getUserVipRank', {
	// 		userid: linked.userid,
	// 	}),
	// ]);

	// console.log('Linking:', player, vip);

	// // Automatically assign the role in Discord after linking
	// await assignDiscordRole(ctx, vip.rank);

	const embed = createEmbed()
		.setTitle('🔐 Account Linked!')
		.setDescription(`Your Discord account has been successfully linked!`)

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Link)
			.setLabel('View Your Profile')
			.setURL(`https://chips.gg/user/${username}`)
	);

	await interaction.editReply({ embeds: [embed], components: [row] });
};

/*
async function assignDiscordRole(ctx, rank) {
	try {
		if (ctx.platform !== 'discord') return;

		const roleID = getRoleIdByRank(rank);
		if (!roleID) {
			console.warn(`No role ID found for rank: ${rank}`);
			return;
		}

		const guild = await ctx.guild?.fetch();
		if (!guild) {
			console.warn('No guild context available');
			return;
		} else {
			// const ALLOWED_GUILD_ID = "541035273547415552";
			// if (guild.id !== ALLOWED_GUILD_ID) {
			//   console.warn(
			//     `Role assignment not allowed in guild: ${ctx.guild?.id}`,
			//   );
			//   return;
			// }
		}

		const member = await guild.members.fetch(ctx.userid);
		if (!member) {
			console.warn(`Member ${ctx.userid} not found in guild`);
			return;
		}

		const botMember = await guild.members.fetch(ctx.userid);
		if (!botMember.permissions.has('MANAGE_ROLES')) {
			console.warn('Bot missing MANAGE_ROLES permission');
			return;
		}
		// if (member.roles.highest.position >= botMember.roles.highest.position) {
		//   console.warn("Bot role position too low to modify member");
		//   return;
		// }
		await member.roles.add(roleID);
		console.log(`Assigned role ${rank} to user ${ctx.userid}`);
	} catch (error) {
		console.error('Error assigning role:', error);
	}
}

function getRoleIdByRank(rank) {
	const roles = {
		flipper: '1106398232382291978',
		collector: '1106398500020834405',
		stacker: '1106520974289010769',
		// tycoon: "1106520974289010769",
		degen: '1084469527737278484',
		booster: '581236016443031677',
		affiliate: '770390850739109900',
	};

	const match = Object.keys(roles).find((key) => rank.toLowerCase().includes(key));
	return match ? roles[match] : null;
}
*/