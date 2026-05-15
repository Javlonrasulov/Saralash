import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations, type Language, type T } from './translations';

const LANG_KEY = 'saralash_lang';

interface AppContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: T;
}

const AppContext = createContext<AppContextValue | null>(null);

function readStoredLang(): Language {
  try {
    const v = localStorage.getItem(LANG_KEY) as Language | null;
    if (v && (v === 'uz_latin' || v === 'uz_cyrillic' || v === 'ru')) return v;
  } catch {
    /* ignore */
  }
  return 'uz_latin';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStoredLang);

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const t = useMemo(() => translations[lang], [lang]);

  useEffect(() => {
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'uz';
  }, [lang]);

  return <AppContext.Provider value={{ lang, setLang, t }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
