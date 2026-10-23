/**
 * Looking up strings. Pure — no React, no Expo — so notification scheduling
 * and tests can use it too. Screens use `useT()` from ./useT.
 */

import { fillTemplate, formatDateFor, type Locale } from '@medtrack/shared';
import { en, hi, type StringKey } from './strings.ts';

const TABLES: Record<Locale, Record<StringKey, string>> = { en, hi };

export type Params = Record<string, string | number>;

export function translate(locale: Locale, key: StringKey, params?: Params): string {
  return fillTemplate(TABLES[locale][key] ?? en[key], params);
}

/** "1 dose left" / "4 doses left", in either language. */
export function dosesLeft(locale: Locale, n: number): string {
  return translate(locale, n === 1 ? 'doses_left_one' : 'doses_left_other', { n });
}

/** See formatDateFor in @medtrack/shared. */
export function formatDate(locale: Locale, localDate: string, style: 'short' | 'long'): string {
  return formatDateFor(localDate, locale, style);
}

export { deviceLocale, resolveLocale } from '@medtrack/shared';

export type { Locale, StringKey };
