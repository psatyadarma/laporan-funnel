// Starts the app for end-to-end tests: builds the client, creates a fresh local database,
// and runs `wrangler dev` with test settings (mock payments, fake AI) on port 8788.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const tmp = resolve(root, 'tests/e2e/.tmp');
const PORT = process.env.APP_PORT ?? '8788';
const AI_PORT = process.env.FAKE_AI_PORT ?? '8790';

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

// wrangler.jsonc → test config with absolute paths and test vars (full-line // comments only).
const cfg = JSON.parse(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'));
cfg.main = resolve(root, cfg.main);
cfg.assets.directory = resolve(root, cfg.assets.directory);
cfg.d1_databases[0].migrations_dir = resolve(root, 'migrations');
cfg.triggers = { crons: [] };
cfg.vars = { ...cfg.vars, PUBLIC_BASE_URL: `http://localhost:${PORT}`, PAYMENT_PROVIDER: 'mock', AI_BASE_URL: `http://localhost:${AI_PORT}`, AI_MODEL: 'fake-model' };
writeFileSync(resolve(tmp, 'wrangler.jsonc'), JSON.stringify(cfg, null, 2));
writeFileSync(resolve(tmp, '.dev.vars'), 'ADMIN_KEY=e2e-admin\nAI_API_KEY=fake-key\n');

const wrangler = resolve(root, 'node_modules/.bin/wrangler');
if (!process.env.SKIP_BUILD) execSync('npx vite build', { cwd: root, stdio: 'inherit' });
execSync(`${wrangler} d1 migrations apply laporan --local --config ${tmp}/wrangler.jsonc --persist-to ${tmp}/state`, { cwd: root, stdio: 'inherit' });
const child = spawn(wrangler, ['dev', '--config', `${tmp}/wrangler.jsonc`, '--persist-to', `${tmp}/state`, '--port', PORT, '--ip', '127.0.0.1'], { cwd: root, stdio: 'inherit' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { child.kill(sig); process.exit(0); });
child.on('exit', (code) => process.exit(code ?? 0));
