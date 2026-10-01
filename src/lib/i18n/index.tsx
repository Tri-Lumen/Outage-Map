'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Locale = 'en' | 'es';

export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

const DEFAULT_LOCALE: Locale = 'en';
const STORAGE_KEY = 'outage-map-locale';

/**
 * Translation dictionary keyed by the literal English source string (the
 * "use the source text as the key" pattern, as in gettext) rather than by an
 * abstract id — so a component just wraps its existing JSX text in t(...)
 * with no separate key to invent or keep in sync.
 *
 * This is infrastructure for the vocabulary genuinely shared across the
 * app — navigation, status labels, common actions — not a full localization
 * of every page's copy. A string with no entry here (or in an unimplemented
 * locale) renders in English, which is the correct fallback, not a bug.
 */
const TRANSLATIONS: Record<Exclude<Locale, 'en'>, Record<string, string>> = {
  es: {
    // Sidebar nav
    'Overview': 'Resumen',
    'Your modular board': 'Tu panel modular',
    'Analytics': 'Analítica',
    'Uptime, SLA & MTTR': 'Disponibilidad, SLA y MTTR',
    'Heat Map': 'Mapa de calor',
    'Geographic density': 'Densidad geográfica',
    'Alerts': 'Alertas',
    'Rules & subscriptions': 'Reglas y suscripciones',
    'Incidents': 'Incidentes',
    'Search all incidents': 'Buscar todos los incidentes',
    'Sources': 'Fuentes',
    'Imported services': 'Servicios importados',
    'Maintenance': 'Mantenimiento',
    'Planned downtime windows': 'Ventanas de mantenimiento planificado',
    'Dependencies': 'Dependencias',
    'Service dependency graph': 'Gráfico de dependencias de servicios',
    'Settings': 'Configuración',
    'Preferences & theme': 'Preferencias y tema',
    // Mobile nav (distinct wording from the desktop sidebar)
    'Status': 'Estado',
    'Map': 'Mapa',
    // Status labels (StatusBadge)
    'Operational': 'Operativo',
    'Degraded': 'Degradado',
    'Major Outage': 'Interrupción mayor',
    'Down': 'Caído',
    'Unknown': 'Desconocido',
    // Common actions, reused across many components
    'Save': 'Guardar',
    'Cancel': 'Cancelar',
    'Delete': 'Eliminar',
    'Export': 'Exportar',
    'Retry': 'Reintentar',
    'Edit': 'Editar',
    'Add': 'Añadir',
    'Close': 'Cerrar',
    'Language': 'Idioma',
  },
};

function translate(locale: Locale, text: string): string {
  if (locale === 'en') return text;
  return TRANSLATIONS[locale]?.[text] ?? text;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (text: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'es';
}

function readLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(readLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const t = (text: string) => translate(locale, text);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return { locale: DEFAULT_LOCALE, setLocale: () => {}, t: (text: string) => text };
  }
  return ctx;
}
