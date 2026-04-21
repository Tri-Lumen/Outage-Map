'use client';

import { useEffect, useState } from 'react';

export interface Preferences {
  refreshInterval: 15 | 30 | 60 | 300;
  compactCards: boolean;
  showDowndetector: boolean;
  pinnedServices: string[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  refreshInterval: 30,
  compactCards: false,
  showDowndetector: true,
  pinnedServices: [],
};

export const PREFERENCES_STORAGE_KEY = 'outage-map-prefs';
export const PREFERENCES_UPDATED_EVENT = 'outage-map-prefs-updated';

function readPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(next: Preferences) {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  // Notify same-tab listeners; the browser only fires `storage` events for
  // other tabs, so components in this tab need a custom signal to re-read.
  window.dispatchEvent(new Event(PREFERENCES_UPDATED_EVENT));
}

export function clearPreferences() {
  try {
    localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(PREFERENCES_UPDATED_EVENT));
}

export function usePreferences(): Preferences {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPrefs(readPreferences());

    const sync = () => setPrefs(readPreferences());
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFERENCES_STORAGE_KEY || e.key === null) sync();
    };

    window.addEventListener(PREFERENCES_UPDATED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PREFERENCES_UPDATED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return prefs;
}
