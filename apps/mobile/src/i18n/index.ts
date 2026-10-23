/**
 * Looking up strings. Pure — no React, no Expo — so notification scheduling
 * and tests can use it too. Screens use `useT()` from ./useT.
 */

import { localeFrom, type Locale } from '@medtrack/shared';
import { en, hi, type StringKey } from './strings.ts';

const TABLES: Record<Locale, Record<StringKey, string>> = { en, hi };

export type Params = Record<string, string | number>;

export function translate(locale: Locale, key: StringKey, params?: Params): string {
  const template = TABLES[locale][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** "1 dose left" / "4 doses left", in either language. */
export function dosesLeft(locale: Locale, n: number): string {
  return translate(locale, n === 1 ? 'doses_left_one' : 'doses_left_other', { n });
}

/**
 * A calendar date in the patient's language: "Thursday 22 October",
 * "गुरुवार, 22 अक्तूबर". Western digits are forced (`nu-latn`) — they match
 * what is printed on the strip.
 */
export function formatDate(locale: Locale, localDate: string, style: 'short' | 'long'): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }
      : { day: 'numeric', month: 'short', timeZone: 'UTC' };
  try {
    return new Date(`${localDate}T00:00:00Z`).toLocaleDateString(
      locale === 'hi' ? 'hi-IN-u-nu-latn' : 'en-GB',
      options,
    );
  } catch {
    return localDate;
  }
}

/** The phone's own language, read without a native module. */
export function deviceLocale(): Locale {
  try {
    return localeFrom(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}

/** A saved choice wins; otherwise follow the phone. */
export function resolveLocale(preference: string | null): Locale {
  return preference ? localeFrom(preference) : deviceLocale();
}

export type { Locale, StringKey };
