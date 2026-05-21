import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
const FONT_KEY = 'saralash_font_scale';
const FONT_SIZE_PX = {
    sm: '13px',
    md: '15px',
    lg: '17px',
    xl: '19px',
};
const ORDER = ['sm', 'md', 'lg', 'xl'];
function readStoredFontScale() {
    try {
        const v = localStorage.getItem(FONT_KEY);
        if (v && ORDER.includes(v))
            return v;
    }
    catch {
        /* ignore */
    }
    return 'md';
}
const FontScaleContext = createContext(null);
export function FontScaleProvider({ children }) {
    const [fontScale, setFontScale] = useState(readStoredFontScale);
    useEffect(() => {
        document.documentElement.style.setProperty('--font-size', FONT_SIZE_PX[fontScale]);
        try {
            localStorage.setItem(FONT_KEY, fontScale);
        }
        catch {
            /* ignore */
        }
    }, [fontScale]);
    const idx = ORDER.indexOf(fontScale);
    const value = {
        fontScale,
        canDecrease: idx > 0,
        canIncrease: idx < ORDER.length - 1,
        decrease: () => {
            if (idx > 0)
                setFontScale(ORDER[idx - 1]);
        },
        increase: () => {
            if (idx < ORDER.length - 1)
                setFontScale(ORDER[idx + 1]);
        },
        reset: () => setFontScale('md'),
    };
    return _jsx(FontScaleContext.Provider, { value: value, children: children });
}
export function useFontScale() {
    const ctx = useContext(FontScaleContext);
    if (!ctx)
        throw new Error('useFontScale must be used within FontScaleProvider');
    return ctx;
}
