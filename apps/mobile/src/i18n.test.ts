import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dosesLeft, translate } from './i18n/index.ts';
import { en, hi } from './i18n/strings.ts';

test('every English string has a Hindi translation', () => {
  // Also enforced by the type of `hi`; this catches an empty string.
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.ok(hi[key] && hi[key].trim().length > 0, `missing Hindi for ${key}`);
  }
});

test('placeholders survive translation', () => {
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    const want = (en[key].match(/\{\w+\}/g) ?? []).sort().join();
    const got = (hi[key].match(/\{\w+\}/g) ?? []).sort().join();
    assert.equal(got, want, `placeholder mismatch in ${key}`);
  }
});

test('fills placeholders', () => {
  assert.equal(translate('en', 'today_done_body', { taken: 3, total: 4 }), '3 of 4 doses taken.');
  assert.equal(translate('hi', 'today_done_body', { taken: 3, total: 4 }), '4 में से 3 खुराक ली गईं।');
});

test('leaves an unknown placeholder visible rather than printing "undefined"', () => {
  assert.equal(translate('en', 'greet_morning', {}), 'Good morning, {name}');
});

test('counts doses in both languages', () => {
  assert.equal(dosesLeft('en', 1), '1 dose left');
  assert.equal(dosesLeft('en', 4), '4 doses left');
  assert.equal(dosesLeft('hi', 4), '4 खुराक बचीं');
});
