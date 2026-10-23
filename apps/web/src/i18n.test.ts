import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en, hi } from './i18n/strings.ts';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('every string has a Hindi version with the same placeholders', () => {
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.ok(hi[key]?.trim(), `no Hindi for ${key}`);
    assert.deepEqual(placeholders(hi[key]), placeholders(en[key]), `placeholders differ in ${key}`);
  }
});

test('Hindi strings use Western digits, as printed on the strip', () => {
  for (const [key, text] of Object.entries(hi)) assert.doesNotMatch(text, /[०-९]/, key);
});
