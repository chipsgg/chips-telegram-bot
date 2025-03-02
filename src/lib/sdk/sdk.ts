import Client from '@chipsgg/openservice-ws-client';
import lodash from 'lodash';
import WS from 'ws';
import { sleep } from '../utils.js';

const initializeSdk = async (CHIPS_TOKEN: string, emit: (event: string, data?: unknown) => unknown = (x) => x) => {
	let state = {};

	const channels = ['games', 'public', 'private', 'auth', 'affiliates', 'stats', 'profitshare', 'community'];

	/**
	 * Authenticate user. If current token fails, fallback to a new token assigned to us
	 */
	async function Authenticate(
		actions: Awaited<ReturnType<typeof Client>>['actions'],
		tokenid?: string,
	): Promise<{ userid: string; tokenid: string }> {
		if (!tokenid) {
			return Authenticate(actions, await actions.auth('token'));
		}
		return actions
			.auth('authenticate', tokenid)
			.then((userid) => {
				return { userid, tokenid };
			})
			.catch(() => {
				return Authenticate(actions);
			});
	}

	const { actions } = await Client(
		WS,
		{
			host: 'wss://api.chips.gg/prod/socket',
			channels,
			keepAlive: 1000,
			wsOptions: {
				handshakeTimeout: 10000,
				maxRetries: 5,
				onError: (err: string) => console.error('WebSocket Error:', err),
			},
		},
		async (type, newState) => {
			switch (type) {
				case 'change': {
					state = {
						...state,
						...newState,
					};
					emit('change', state);
					break;
				}
				case 'open': {
					console.log('Server Connected!');
					break;
				}
				case 'close': {
					console.log('Server Disconnected!');
					console.log(state, newState);
					break;
				}
				case 'reconnect': {
					console.log('Server Reconnected!');
					// updateState("setConnected", true);
					await Authenticate(actions, CHIPS_TOKEN).then((result) => {
						console.log('authenticated', result);
					});
					break;
				}
			}
		},
	);

	// actions.community('replyToChatMessage', {
	//   text: 'Hello World!',
	//   messageid
	// })

	// actions.community('editChatMessage', {
	//   text: 'Hello World!',
	//   messageid
	// })

	// actions.community('removeChatMessage', {
	//   messageid
	// })

	async function getRandomSlot() {
		const slots = (await actions.public('listGamesMostPlayed', {
			skip: 0,
			limit: 100,
		})) as { id: string; tags: string[] }[];
		return lodash.sample(slots.filter((x) => x.tags.includes('slots')));
	}

	// const sendRngSlotChat = async (rngGame: { id: string }) => {
	// 	const msg = await actions.community('publishChatMessage', {
	// 		type: 'game',
	// 		text: `Random Slot Pick:`,
	// 		// image: rngGame.images.s2,
	// 		data: rngGame,
	// 		// roomid
	// 		id: rngGame.id,
	// 	});

	// 	await sleep(250);

	// 	await actions.community('addChatMessageReaction', {
	// 		messageid: msg.id,
	// 		assetid: 'chart_with_downwards_trend',
	// 	});

	// 	await sleep(250);

	// 	await actions.community('addChatMessageReaction', {
	// 		messageid: msg.id,
	// 		assetid: 'chart_with_upwards_trend',
	// 	});
	// };

	// NOTE: Login Client SDK
	const { userid } = await Authenticate(actions, CHIPS_TOKEN);

	// Authenticated mode
	if (userid) {
		const user = await actions.private('me');
		console.log('Authenticated SDK:', user.id, user.username);

		// actions.community("publishChatMessage", {
		//   text: `Hello, I am ${user.username}!`,
		//   // roomid
		// });

		// pickRandomForChat();

		// const tick = async () => {
		// 	const rngGame = await getRandomSlot();
		// 	if (!rngGame) {
		// 		console.error('No RNG Game Found');
		// 		await sleep(1000 * 60 * 30);
		// 		tick();
		// 		return;
		// 	}

		// 	console.log('rng.game', rngGame.id);

		// 	try {
		// 		// make koth
		// 		await actions.private('createKothChallenge', {
		// 			catalogid: rngGame.id,
		// 			multiplier: 10,
		// 			// currency: "usdt",
		// 			// amount: "100000000",
		// 			currency: 'trx',
		// 			amount: '100000000',
		// 			duration: 1000 * 60 * 15, // 15min.
		// 		});

		// 		// notify chat
		// 		await sendRngSlotChat(rngGame);

		// 		// wait to post again
		// 		await sleep(1000 * 60 * 60 * 1);
		// 	} catch (e) {
		// 		// wait...
		// 		console.error('ERROR:', e);
		// 	}

		// 	await sleep(1000 * 60 * 30);
		// 	tick();
		// };

		// tick();
	}

	// subscriptions
	setInterval(() => {
		actions.profitshare('on', { name: 'profitshareInfo' });
		actions.profitshare('on', { name: 'profitshareBalance' });
		actions.stats('on', { game: 'bets', type: 'recentBets' });
		actions.stats('on', { game: 'bets', type: 'luckiest' });
		actions.stats('on', { game: 'bets', type: 'bigwins' });
		actions.community('on', { name: 'chats', path: ['public'] });
	}, 1000);

	return {
		...actions,
		state: () => state,
		get: (...path: string[]) => lodash.get(state, path),
		getRandomSlot,
	};
};

type SDK = Awaited<ReturnType<typeof initializeSdk>>;

export { initializeSdk, type SDK };
