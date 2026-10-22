/**
 * Run with:  npm test --prefix apps/mobile
 *
 * The case that matters is the third one: before this logic existed the app
 * shipped `http://localhost:5000/api` to physical phones, where localhost is
 * the phone, so it could not reach the API at all.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickApiUrl } from './api-url.ts';

test('a real configured URL always wins', () => {
  assert.equal(
    pickApiUrl({ configured: 'https://api.medtrack.app/api', hostUri: '192.168.1.6:8081', dev: true }),
    'https://api.medtrack.app/api',
  );
});

test('production keeps the configured URL even when it is localhost', () => {
  assert.equal(
    pickApiUrl({ configured: 'http://localhost:5000/api', hostUri: undefined, dev: false }),
    'http://localhost:5000/api',
  );
});

test('development replaces the localhost default with the Metro host', () => {
  assert.equal(
    pickApiUrl({ configured: 'http://localhost:5000/api', hostUri: '192.168.1.6:8081', dev: true }),
    'http://192.168.1.6:5000/api',
  );
});

test('127.0.0.1 is treated as localhost too', () => {
  assert.equal(
    pickApiUrl({ configured: 'http://127.0.0.1:5000/api', hostUri: '10.0.0.42:8081', dev: true }),
    'http://10.0.0.42:5000/api',
  );
});

test('falls back to localhost when there is no host to borrow', () => {
  assert.equal(
    pickApiUrl({ configured: undefined, hostUri: undefined, dev: true }),
    'http://localhost:5000/api',
  );
});
