import fs from 'fs';
import path from 'path';
import e from 'express';
import MarkdownIt from 'markdown-it';
import { type ChipsCommand, type CommandGroup, CommandType } from './lib/commands/index.js';

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

export async function initializeExpress(commands: Map<string, ChipsCommand | CommandGroup>) {
	console.log('[EXPRESS] Initializing...');

	// console.log(express);
	const app = e();
	app.set('view engine', 'ejs');
	app.set('views', path.join(_dirname, '../views'));
	app.use(e.static(path.join(_dirname, '../public')));

	const md = new MarkdownIt({
		highlight: function (str: string, lang: string): string {
			return `<pre class="code-block"><code class="language-${lang}">${md.utils.escapeHtml(str)}</code></pre>`;
		},
	});

	app.get('/', (_, res) => {
		const readmeContent = fs.readFileSync('README.md', 'utf-8');
		const renderedContent = md.render(readmeContent);
		res.render('index', {
			title: 'Chips.gg Bot',
			content: renderedContent,
		});
	});

	app.get('/commands', (_, res) => {
		res.render('commands', {
			title: 'Available Commands',
			commands: Array.from(commands.values())
				.filter((cmd) => !cmd.disabled && cmd.type === CommandType.Slash)
				.map(({ name, description }) => ({
					name,
					description,
				})),
		});
	});

	// app.get('/api/command/:name', async (req, res) => {
	// 	const { name } = req.params;

	// 	const command = commands.get(name);
	// 	if (!command) {
	// 		res.status(404).json({ error: 'Command not found' });
	// 	}

	// 	try {
	// 		const ctx = {
	// 			platform: 'api',
	// 			sendForm: (form) => form,
	// 			sendText: (text) => ({ text }),
	// 			// getArg: req.query
	// 			getString: (key) => req.query[key],
	// 		};

	// 		const result = await command.handler(ctx);
	// 		res.json(result);
	// 	} catch (error) {
	// 		res.status(500).json({ error: error.message });
	// 	}
	// });

	const port = +(process.env.PORT || 3000);
	app.listen(port, '0.0.0.0', () => {
		console.log(`[EXPRESS] Web server running on port ${port}`);
	});
}
