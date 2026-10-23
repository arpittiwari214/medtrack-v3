import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { resolveLocale, translate, type Params, type StringKey } from './index';

/** The current language and a translate function bound to it. */
export function useT() {
  const { prefs } = useApp();
  const locale = resolveLocale(prefs.language);
  const t = useCallback((key: StringKey, params?: Params) => translate(locale, key, params), [locale]);
  return { t, locale };
}
