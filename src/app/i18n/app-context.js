import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from './translations';
const LANG_KEY = 'saralash_lang';
const AppContext = createContext(null);
function readStoredLang() {
    try {
        const v = localStorage.getItem(LANG_KEY);
        if (v && (v === 'uz_latin' || v === 'uz_cyrillic' || v === 'ru'))
            return v;
    }
    catch {
        /* ignore */
    }
    return 'uz_latin';
}
export function AppProvider({ children }) {
    const [lang, setLangState] = useState(readStoredLang);
    const setLang = (next) => {
        setLangState(next);
        try {
            localStorage.setItem(LANG_KEY, next);
        }
        catch {
            /* ignore */
        }
    };
    const t = useMemo(() => translations[lang], [lang]);
    useEffect(() => {
        document.documentElement.lang = lang === 'ru' ? 'ru' : 'uz';
    }, [lang]);
    return _jsx(AppContext.Provider, { value: { lang, setLang, t }, children: children });
}
export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx)
        throw new Error('useApp must be used within AppProvider');
    return ctx;
}
