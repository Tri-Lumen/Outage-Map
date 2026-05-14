'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'solarized-dark' | 'solarized-light' | 'black-grey' | 'midnight' | 'auto' | 'custom';

export const THEMES: { value: Theme; label: string; description: string }[] = [
  { value: 'auto',            label: 'Auto (system)',  description: 'Follows your OS light/dark preference.' },
  { value: 'solarized-dark',  label: 'Solarized Dark', description: 'Warm cyan-on-teal palette from Ethan Schoonover.' },
  { value: 'solarized-light', label: 'Solarized Light', description: 'Cream-and-ink variant of the Solarized palette.' },
  { value: 'black-grey',      label: 'Classic Dark',   description: 'Traditional near-black background with neutral greys.' },
  { value: 'midnight',        label: 'Midnight',        description: 'Deep navy blue with slate accents.' },
  { value: 'custom',          label: 'Custom…',        description: 'Pick your own background / surface / foreground / muted.' },
];

const CONCRETE_THEMES: Theme[] = ['solarized-dark', 'solarized-light', 'black-grey', 'midnight', 'custom'];
const VALID_THEMES: Theme[] = THEMES.map((t) => t.value);
const DEFAULT_THEME: Theme = 'solarized-dark';
const STORAGE_KEY = 'outage-map-theme';
const CUSTOM_STORAGE_KEY = 'outage-map-custom-theme';
const LEGACY_MAP: Record<string, Theme> = {
  dark: 'solarized-dark',
  light: 'solarized-light',
};

export interface CustomTheme {
  background: string;
  surface: string;
  surfaceElevated: string;
  foreground: string;
  muted: string;
}

export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  background: '#0a0a0a',
  surface: '#141414',
  surfaceElevated: '#1f1f1f',
  foreground: '#e5e5e5',
  muted: '#a3a3a3',
};

const CUSTOM_VAR_MAP: Record<keyof CustomTheme, string> = {
  background:      '--background',
  surface:         '--surface',
  surfaceElevated: '--surface-elevated',
  foreground:      '--foreground',
  muted:           '--muted',
};

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  customTheme: CustomTheme;
  setCustomTheme: (next: Partial<CustomTheme>) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isTheme(value: string | null): value is Theme {
  return !!value && (VALID_THEMES as string[]).includes(value);
}

function systemPreference(): 'solarized-dark' | 'solarized-light' {
  if (typeof window === 'undefined') return 'solarized-dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'solarized-dark' : 'solarized-light';
}

function applyTheme(theme: Theme, customTheme: CustomTheme) {
  const root = document.documentElement;
  const concrete = theme === 'auto' ? systemPreference() : theme;
  root.classList.remove(...CONCRETE_THEMES);
  root.classList.add(concrete);
  root.dataset.theme = concrete;

  // Clear inline custom vars; re-apply only when theme is 'custom'.
  for (const cssVar of Object.values(CUSTOM_VAR_MAP)) {
    root.style.removeProperty(cssVar);
  }
  if (theme === 'custom') {
    for (const [k, cssVar] of Object.entries(CUSTOM_VAR_MAP) as [keyof CustomTheme, string][]) {
      root.style.setProperty(cssVar, customTheme[k]);
    }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [customTheme, setCustomThemeState] = useState<CustomTheme>(DEFAULT_CUSTOM_THEME);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) setThemeState(stored);
    else if (stored && stored in LEGACY_MAP) setThemeState(LEGACY_MAP[stored]);

    try {
      const customRaw = localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (customRaw) {
        const parsed = JSON.parse(customRaw) as Partial<CustomTheme>;
        setCustomThemeState({ ...DEFAULT_CUSTOM_THEME, ...parsed });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    applyTheme(theme, customTheme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme, customTheme]);

  // Auto-follow OS light/dark while theme === 'auto'.
  useEffect(() => {
    if (theme !== 'auto' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('auto', customTheme);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, customTheme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(() =>
    setThemeState((t) => {
      const idx = VALID_THEMES.indexOf(t);
      return VALID_THEMES[(idx + 1) % VALID_THEMES.length];
    }), []);

  const setCustomTheme = useCallback((patch: Partial<CustomTheme>) => {
    setCustomThemeState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, customTheme, setCustomTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
      toggle: () => {},
      customTheme: DEFAULT_CUSTOM_THEME,
      setCustomTheme: () => {},
    };
  }
  return ctx;
}
