'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'solarized-dark' | 'solarized-light' | 'black-grey';

export const THEMES: { value: Theme; label: string; description: string }[] = [
  {
    value: 'solarized-dark',
    label: 'Solarized Dark',
    description: 'Warm cyan-on-teal palette from Ethan Schoonover.',
  },
  {
    value: 'solarized-light',
    label: 'Solarized Light',
    description: 'Cream-and-ink variant of the Solarized palette.',
  },
  {
    value: 'black-grey',
    label: 'Classic Dark',
    description: 'Traditional near-black background with neutral greys.',
  },
];

const VALID_THEMES: Theme[] = THEMES.map((t) => t.value);
const DEFAULT_THEME: Theme = 'solarized-dark';
const STORAGE_KEY = 'outage-map-theme';
const LEGACY_MAP: Record<string, Theme> = {
  dark: 'solarized-dark',
  light: 'solarized-light',
};

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isTheme(value: string | null): value is Theme {
  return !!value && (VALID_THEMES as string[]).includes(value);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) {
      setThemeState(stored);
    } else if (stored && stored in LEGACY_MAP) {
      setThemeState(LEGACY_MAP[stored]);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(...VALID_THEMES);
    root.classList.add(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggle = () =>
    setThemeState((t) => {
      const idx = VALID_THEMES.indexOf(t);
      return VALID_THEMES[(idx + 1) % VALID_THEMES.length];
    });

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { theme: DEFAULT_THEME, setTheme: () => {}, toggle: () => {} };
  }
  return ctx;
}
