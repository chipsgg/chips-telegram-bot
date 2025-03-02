import fs from 'fs';
import type { CommandGroup } from './index.js';

export async function registerFiles<T>(
	folder: string,
	depth = 1,
	filter: (fileName: string) => boolean,
	callback: (data: T) => void,
	absolute = './src/',
	relative = '../../',
) {
	if (depth < 1) return;

	if (depth > 1) {
		const subFolders = fs
			.readdirSync(`${absolute}${folder}`)
			.filter((fileName) => fs.lstatSync(`${absolute}${folder}/${fileName}`).isDirectory());

		for (const subFolder of subFolders) {
			await registerFiles(`${folder}/${subFolder}`, depth - 1, filter, callback);
		}
	}

	// console.log(`Scanning: ${absolute}${folder}`);
	const files = fs.readdirSync(`${absolute}${folder}`);

	for (const file of files.filter(filter)) {
		// console.log(`Loading: ${relative}${folder}/${file.replace('.ts', '.js')}`);
		const imported = await import(`${relative}${folder}/${file.replace('.ts', '.js')}`);
		callback(imported.default);
	}
}

export async function registerFeatures<T>(
	folder: string,
	filter: (fileName: string) => boolean,
	callback: (data: T) => void,
	depth = 1,
	absolute = './src/',
	relative = '../../',
) {
	if (depth < 1) return;

	if (depth > 1) {
		const subFolders = fs
			.readdirSync(`${absolute}${folder}`)
			.filter((fileName) => fs.lstatSync(`${absolute}${folder}/${fileName}`).isDirectory());

		for (const subFolder of subFolders) {
			await registerFeatures(`${folder}/${subFolder}`, filter, callback, depth - 1);
		}
	}

	// console.log(`Scanning: ${absolute}${folder}`);
	const files = fs.readdirSync(`${absolute}${folder}`);

	if (files.includes('command.ts') || files.includes('command.js')) {
		// console.log(`Loading: ${relative}${folder}/command.js`);
		const imported = await import(`${relative}${folder}/command.js`);
		callback(imported.default);
	}

	const folders = files.filter((fileName) => fs.lstatSync(`${absolute}${folder}/${fileName}`).isDirectory());

	for (const subFolder of folders) {
		if (subFolder !== 'buttons') continue;
		registerFiles(`${folder}/${subFolder}`, 1, filter, callback, absolute, relative);
	}
}

export async function registerCommandGroups(
	folder: string,
	depth = 1,
	callback: (folder: string, group: CommandGroup) => Promise<void>,
) {
	if (depth < 1) return;

	if (depth > 1) {
		const subFolders = fs
			.readdirSync(`./src/${folder}`)
			.filter((fileName) => fs.lstatSync(`./src/${folder}/${fileName}`).isDirectory());

		for (const subFolder of subFolders) {
			await registerCommandGroups(`${folder}/${subFolder}`, depth - 1, callback);
		}
	}

	const files = fs
		.readdirSync(`./src/${folder}`)
		.filter((fileName) => fs.lstatSync(`./src/${folder}/${fileName}`).isDirectory());

	for (const file of files) {
		const imported = await import(`../../${folder}/${file}/command.js`);
		await callback(`${folder}/${file}`, imported.default);
	}
}
