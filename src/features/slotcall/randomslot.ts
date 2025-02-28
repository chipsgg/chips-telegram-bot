import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { DiscordPlatformContext, type IPlatformContext } from "../../platforms/context.js";

export async function getRandomSlot({ sdk }: IPlatformContext<RandomSlotProcess>): Promise<RandomSlotProcess> {
	const games = await sdk.public("listGamesMostPlayed", {
		skip: 0,
		limit: 100,
	}).catch(() => null);

	if (!games) return { error: "Failed to fetch slots!" };

	const slots = games.filter((game) => game.tags.includes("slots"));

	const slot = slots[Math.floor(Math.random() * slots.length)];
	if (!slot) return { error: "No slots found!" };

	return { slot };
}

export function discordEmbed({ slot }: RandomSlotProcess) {
	if (!slot) return { content: "Failed to fetch slot!" };
	
	const embed = DiscordPlatformContext.createEmbed()
		.setAuthor({
			name: slot.title,
			url: `https://chips.gg/slots/${slot.slug}`,
		})
		.setDescription(`:tophat: ${slot.producer}\n:moneybag: RTP **${slot.rtp}%**\n-# :label: ${slot.tags.join(", ")}`)
		
	if (slot.images.s1) {
		embed.setThumbnail(slot.images.s1);
	} else if (slot.images.bg) {
		embed.setThumbnail(slot.images.bg);
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Link)
			.setLabel('Play now!')
			.setURL(`https://chips.gg/slots/${slot.slug}`),
		new ButtonBuilder()
			.setStyle(ButtonStyle.Primary)
			.setLabel('Reroll')
			.setCustomId('SLOTCALL')
	);

	return { embeds: [embed], components: [row] };
}

export type RandomSlotProcess = {
	error?: string;
	slot?: {
		id: string;
		title: string;
		slug: string;
		tags: string[];
		rtp: string;
		provider: string;
		producer: string;
		images: {
			bg?: string;
			[key: string]: string | undefined;
		};
	}
};