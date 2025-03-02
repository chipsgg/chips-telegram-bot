import type { SDK } from './sdk/sdk.js';

export const sleep = (t: number) => new Promise((resolve) => setTimeout(resolve, t));

/**
 * Given a string, complete any markdown formatting that got cut off.
 */
export function completeMarkdown(str: string) {
	const markdown = {
		'*': false,
		'**': false,
		_: false,
		'~': false,
		'`': false,
	};
	const keys = Object.keys(markdown);
	for (const key of keys) {
		let regex;
		if (key === '**') {
			regex = new RegExp('\\*\\*', 'g');
		} else if (key === '*') {
			regex = new RegExp('\\*', 'g');
		} else if (key === '_') {
			regex = new RegExp('_', 'g');
		} else if (key === '~') {
			regex = new RegExp('~', 'g');
		} else if (key === '`') {
			regex = new RegExp('`', 'g');
		} else {
			continue; // Should not happen
		}
		const count = (str.match(regex) || []).length;
		markdown[key as keyof typeof markdown] = count % 2 === 1;
	}
	let completed = str;
	for (const key of keys) {
		if (markdown[key as keyof typeof markdown]) {
			completed += key;
		}
	}
	return completed;
}

export async function fetchCurrencies(sdk: SDK) {
	try {
		const currencies = await sdk.get('public', 'currencies');
		return currencies as Record<
			string,
			{
				name: string;
				price: number;
				decimals: number;
				hidden: boolean;
			}
		> | null;
	} catch (e) {
		console.error(e);
		return null;
	}
}
