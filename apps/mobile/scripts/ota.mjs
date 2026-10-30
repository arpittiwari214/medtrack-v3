/**
 * Publish an over-the-air update to installed phones: npm run ota -- "what changed"
 *
 * eas.json's build env does not apply to `eas update`. Without MEDTRACK_API_URL
 * the update would carry the localhost API from app.json and every phone that
 * downloaded it would stop syncing, so it is read from the preview profile here.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const profile = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')).build.preview;
const message = process.argv.slice(2).join(' ').trim();
if (!message) throw new Error('Say what changed: npm run ota -- "Fix the Skip button"');

execFileSync(
  'npx',
  ['eas-cli', 'update', '--channel', profile.channel, '--platform', 'android', '--message', JSON.stringify(message), '--non-interactive'],
  { stdio: 'inherit', shell: true, env: { ...process.env, ...profile.env } },
);
