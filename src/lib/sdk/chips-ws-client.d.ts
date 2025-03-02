declare module '@chipsgg/openservice-ws-client' {
	type Actions = {
		auth(route: 'token'): Promise<string>;
		auth(route: 'auth', options: { token: string; user_id: string }): Promise<unknown>;
		auth(route: 'authenticate', token: string): Promise<string>;
		auth(
			route: 'linkPlatformID',
			options: {
				platformid: string;
				platform: string;
				userid: string;
				code: string;
			},
		): Promise<{ userid: string }>;

		public(route: 'echo', options: { message: string }): Promise<{ message: string }>;

		public(route: 'getBet', options: { gamename: string; betid: string }): Promise<unknown>;

		public(route: 'listRaceRanks', options: { raceid: string }): Promise<unknown>;

		public(route: 'listRacePrizes', options: { raceid: string }): Promise<unknown>;

		public(route: 'listActiveRaces', options: { skip: number; limit: number }): Promise<unknown>;

		public(route: 'listDoneRaces', options: { skip: number; limit: number }): Promise<unknown>;

		public(route: 'listSlotCategories'): Promise<unknown>;

		public(route: 'listSlotsByCategory', options: { category: string }): Promise<unknown>;

		public(route: 'listRunningPromotions'): Promise<
			{
				gameprovider: 'chipsgg';
				id: string;
				roomid: string;
				type: 'promotion';
				gamename: 'promotion';
				created: number;
				done: boolean;
				history: {
					pregame: unknown;
					running: unknown;
					cooldown: unknown;
				};
				state: 'cooldown' | 'running';
				bets: {};
				userid: string;
				action: {
					image: string;
					title: string;
					route: string;
				};
				bannerImage: string;
				cardImage: string;
				title: string;
				subtitle: string;
				description: string;
				startTime: number;
				endTime: number;
			}[]
		>;

		public(
			route: 'listGamesMostPlayed',
			options: {
				/** @default 100 */
				limit: number;
				/** @default 0 */
				skip: number;
				/** Unix milliseconds */
				end?: string;
				/** Unix milliseconds */
				start?: string;
				/** @default "1m" */
				duration?: string;
				/** @default -1 */
				sortDirection?: -1 | 1;
				/** @default "count" */
				sortKey?: string;
			},
		): Promise<
			{
				id: string;
				title: string;
				provider: string;
				producer: string;
				images: {
					bg?: string;
					[key: string]: string | undefined;
				};
				slug: string;
				tags: string[];
				rtp: string;
				stats: {
					wageredUsd: number;
					profitMaxUsd: number;
					wageredMaxUsd: number;
					count: number;
					wins: number;
				};
			}[]
		>;

		public(route: 'searchGames', options: { term: string; limit: number; skip: number }): Promise<unknown>;

		public(
			route: 'getGameDetails',
			options: { catalogid: string },
		): Promise<{
			_id: string;
			slug: string;
			created: number;
			tags: string[];
			restrictions: [];
			images?: {
				s1?: string;
				s2?: string;
				bg?: string;
			};
			enabled: true;
			id: string;
			title: string;
			producer: string;
			provider: string;
			category: string;
			updated: number;
			rtp: number;
		} | null>;

		public(
			route: 'currencies',
			currency: string,
		): Promise<{
			decimals: boolean;
			name: string;
			price: number;
		}>;

		public(
			route: 'getPlayer',
			options: { userid: string },
		): Promise<{
			id: string;
			username: string;
			nickname: string | null;
			avatar: string;
			profileBackgroundURL: string;
			profileBannerURL: string;
			profileMessage: string | null;
			muted: null;
			isAdmin: boolean;
			isMod: boolean;
			currency: string;
			withdrawDisabled: boolean;
			created: number;
			country: string;
			lastLogin: number;
			vip?: {
				exp: number;
				level: number;
				tier: number;
				rank: string;
				baseLevelExp: number;
				nextLevelExp: number;
			};
			stats: {
				count: number;
				wins: number;
				wageredUsd: number;
				bonusesUsd: number;
			};
			mostPlayed: {
				_id: string;
				slug: string;
				created: number;
				tags: unknown[];
				restrictions: unknown[];
				images: unknown[];
				enabled: true;
				title: string;
				description?: string;
				producer: string;
				provider: string;
				category: string;
				id: string;
				name?: string;
				product?: string;
				features?: unknown[];
				rtp: number;
				languages?: string[];
				blocked_countries?: unknown[];
				game_code?: string;
				release_date?: string;
				certifications?: unknown[];
				freebet_support?: boolean;
				hit_ratio?: string;
				paylines?: null;
				platforms?: unknown[];
				technology?: unknown[];
				theme?: unknown[];
				url_background?: string;
				url_thumb?: string;
				volatility?: number;
				game_id?: number;
				demo_game_support?: boolean;
				phoenix_jackpot_support?: boolean;
				aggrigator?: string;
				identifier?: string;
				updated: number;
				reason?: string;
				stats: unknown[];
			}[];
		}>;

		public(
			route: 'getUser',
			options: { userid: string },
		): Promise<{
			id: string;
			username: string;
			avatar: string;
			profileBannerURL: string;
			currency: string;
			created: number;
			country: string;
			lastLogin: number;
		}>;

		public(route: 'getUserVipRank', options: { userid: string }): Promise<unknown>;

		public(
			route: 'getUserStats',
			options: {
				userid: string;
				duration: string;
			},
		): Promise<unknown>;

		public(
			route: 'searchGames',
			options: {
				term: string;
				limit: number;
				skip: number;
			},
		): Promise<unknown>;

		public(route: 'getPromotion', options: { gameid: string }): Promise<unknown>;

		community(
			route: 'publishChatMessage',
			options: {
				type: string;
				text: string;
				data: unknown;
				id: string;
			},
		): Promise<unknown>;

		community(route: 'addChatMessageReaction', options: { messageid: string; assetid: string }): Promise<unknown>;

		private(route: 'me'): Promise<{
			id: string;
			username: string;
		}>;

		private(
			route: 'createKothChallenge',
			options: {
				catalogid: string;
				multiplier: number;
				currency: string;
				amount: string;
				duration: number;
			},
		): Promise<unknown>;

		profitshare(route: 'on', options: { name: 'profitshareInfo' | 'profitshareBalance' });
		stats(route: 'on', options: { game: string; type: string });

		community(route: 'on', options: { name: string; path: string[] }): Promise<unknown>;
	};

	function WSClient(
		websocket: typeof import('ws').WebSocket,
		options: {
			host: string;
			channels: string[];
			keepAlive: number;
			wsOptions: {
				handshakeTimeout: 10000;
				maxRetries: 5;
				onError: (err: string) => void;
			};
		},
		handle: (type: string, newState: Record<string, unknown>) => unknown,
	): Promise<{ actions: Actions }>;

	export = WSClient;

	export type { Actions };
}
