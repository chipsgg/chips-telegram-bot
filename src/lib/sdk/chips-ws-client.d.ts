declare module '@chipsgg/openservice-ws-client' {
	interface Actions {
		auth(route: 'token'): Promise<string>;
		auth(route: 'auth', options: { token: string; user_id: string }): Promise<any>;
		auth(route: 'authenticate', token: string): Promise<string>;
		auth(
			route: 'linkPlatformID',
			options: {
				platformid: string;
				platform: string;
				userid: string;
				code: string;
			},
		): Promise<any>;

		public(route: 'echo', options: { message: string }): Promise<{ message: string }>;

		public(route: 'getBet', options: { gamename: string; betid: string }): Promise<any>;

		public(route: 'listRaceRanks', options: { raceid: string }): Promise<any>;

		public(route: 'listRacePrizes', options: { raceid: string }): Promise<any>;

		public(route: 'listActiveRaces', options: { skip: number; limit: number }): Promise<any>;

		public(route: 'listDoneRaces', options: { skip: number; limit: number }): Promise<any>;

		public(route: 'listSlotCategories'): Promise<any>;

		public(route: 'listSlotsByCategory', options: { category: string }): Promise<any>;

		public(route: 'listRunningPromotions'): Promise<any>;

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
		): Promise<any>;

		public(route: 'currencies'): Promise<any>;

		public(route: 'getUser', options: { userid: string }): Promise<any>;

		public(route: 'getUserVipRank', options: { userid: string }): Promise<any>;

		public(
			route: 'getUserStats',
			options: {
				userid: string;
				duration: string;
			},
		): Promise<any>;

		public(
			route: 'searchGames',
			options: {
				term: string;
				limit: number;
				skip: number;
			},
		): Promise<any>;

		public(route: 'getPromotion', options: { gameid: string }): Promise<any>;

		community(
			route: 'publishChatMessage',
			options: {
				type: string;
				text: string;
				data: unknown;
				id: string;
			},
		): Promise<any>;

		community(route: 'addChatMessageReaction', options: { messageid: string; assetid: string }): Promise<any>;

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
		): Promise<any>;

		profitshare(route: 'on', options: { name: 'profitshareInfo' | 'profitshareBalance' });
		stats(route: 'on', options: { game: string; type: string });

		community(route: 'on', options: { name: string; path: string[] }): Promise<any>;
	}

	function WSClient(
		websocket: typeof import('ws').WebSocket,
		options: {
			host: string,
			channels: string[],
			keepAlive: number,
			wsOptions: {
				handshakeTimeout: 10000,
				maxRetries: 5,
				onError: (err: string) => void,
			},
		},
		handle: (type: string, newState: Record<string, unknown>) => unknown,
	): Promise<{ actions: Actions }>;

	export = WSClient;

	export type { Actions };
}
