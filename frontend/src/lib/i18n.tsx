'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import en from './i18n/en.json';
import es from './i18n/es.json';

export type Locale = 'en' | 'es';

const dictionaries: Record<Locale, Record<string, unknown>> = { en, es };
const STORAGE_KEY = 'hackgb-lang';

type Dict = Record<string, string>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a dot-path key, e.g. t('nav.students'). Falls back to English,
   *  then to the key itself, so a missing string never renders blank. */
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (k) => k,
});

function lookup(dict: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let node: unknown = dict;
  for (const p of parts) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[p];
  }
  return typeof node === 'string' ? node : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    return stored === 'es' ? 'es' : 'en';
  });

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors (private mode etc.)
    }
  }, []);

  const t = useCallback(
    (key: string) =>
      lookup(dictionaries[locale] as Dict, key) ??
      lookup(dictionaries.en as Dict, key) ??
      key,
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
