/**
 * Interface language for the website. The same idea as the phone app: one
 * string table with an English and a Hindi column, chosen per browser.
 *
 * The legal pages stay in English: a translated privacy notice or contract has
 * to come from a lawyer or certified translator, not from this table.
 */

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fillTemplate, formatDateFor, resolveLocale, splitTemplate, type Locale } from '@medtrack/shared';
import { en, hi, type StringKey } from './strings.js';

const TABLES: Record<Locale, Record<StringKey, string>> = { en, hi };
const STORAGE_KEY = 'mt.lang';

export type Params = Record<string, string | number>;

export function translate(locale: Locale, key: StringKey, params?: Params): string {
  return fillTemplate(TABLES[locale][key] ?? en[key], params);
}

function readPreference(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface LanguageValue {
  locale: Locale;
  /** null follows the browser. */
  preference: string | null;
  setPreference: (preference: string | null) => void;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<string | null>(readPreference);
  const locale = resolveLocale(preference);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setPreference = useCallback((next: string | null) => {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // A private window may refuse storage; the choice still applies until reload.
    }
    setPreferenceState(next);
  }, []);

  const value = useMemo(() => ({ locale, preference, setPreference }), [locale, preference, setPreference]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useT() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useT must be used inside <LanguageProvider>');
  const { locale } = context;
  const t = useCallback((key: StringKey, params?: Params) => translate(locale, key, params), [locale]);
  const date = useCallback(
    (localDate: string, style: 'short' | 'long' | 'full' = 'full') => formatDateFor(localDate, locale, style),
    [locale],
  );
  return { t, date, ...context };
}

/**
 * A translated sentence with React nodes, such as links, in place of its
 * {placeholders} — word order differs between languages, so a link cannot
 * simply be appended.
 */
export function interleave(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return splitTemplate(template).map((part, index) =>
    index % 2 === 1 ? <Fragment key={index}>{nodes[part] ?? `{${part}}`}</Fragment> : part,
  );
}

export type { StringKey };
