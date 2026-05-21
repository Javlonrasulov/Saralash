import React, { createContext, useContext, useEffect, useState } from 'react';

export type FontScale = 'sm' | 'md' | 'lg' | 'xl';

const FONT_KEY = 'saralash_font_scale';

const FONT_SIZE_PX: Record<FontScale, string> = {
  sm: '13px',
  md: '15px',
  lg: '17px',
  xl: '19px',
};

const ORDER: FontScale[] = ['sm', 'md', 'lg', 'xl'];

function readStoredFontScale(): FontScale {
  try {
    const v = localStorage.getItem(FONT_KEY) as FontScale | null;
    if (v && ORDER.includes(v)) return v;
  } catch {
    /* ignore */
  }
  return 'md';
}

interface FontScaleContextValue {
  fontScale: FontScale;
  decrease: () => void;
  increase: () => void;
  reset: () => void;
  canDecrease: boolean;
  canIncrease: boolean;
}

const FontScaleContext = createContext<FontScaleContextValue | null>(null);

export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScale] = useState<FontScale>(readStoredFontScale);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-size', FONT_SIZE_PX[fontScale]);
    try {
      localStorage.setItem(FONT_KEY, fontScale);
    } catch {
      /* ignore */
    }
  }, [fontScale]);

  const idx = ORDER.indexOf(fontScale);

  const value: FontScaleContextValue = {
    fontScale,
    canDecrease: idx > 0,
    canIncrease: idx < ORDER.length - 1,
    decrease: () => {
      if (idx > 0) setFontScale(ORDER[idx - 1]);
    },
    increase: () => {
      if (idx < ORDER.length - 1) setFontScale(ORDER[idx + 1]);
    },
    reset: () => setFontScale('md'),
  };

  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
}

export function useFontScale() {
  const ctx = useContext(FontScaleContext);
  if (!ctx) throw new Error('useFontScale must be used within FontScaleProvider');
  return ctx;
}
