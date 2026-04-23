'use client';

import { useEffect, useState } from 'react';
import { SERVICES } from '@/lib/services';
import {
  DEFAULT_PREFERENCES,
  Preferences,
  clearPreferences,
  usePreferences,
  writePreferences,
} from '@/hooks/usePreferences';
import { useTheme, THEMES, type Theme } from './ThemeProvider';
import PageHeader from './ui/PageHeader';
import Card from './ui/Card';

const THEME_PREVIEWS: Record<Theme, {
  wrapper: string;
  primaryBar: string;
  secondaryBar: string;
  accentBar: string;
}> = {
  'solarized-dark': {
    wrapper: 'bg-[#002b36] border-[#073642]',
    primaryBar: 'bg-[#93a1a1]',
    secondaryBar: 'bg-[#586e75]',
    accentBar: 'bg-[#268bd2]',
  },
  'solarized-light': {
    wrapper: 'bg-[#fdf6e3] border-[#eee8d5]',
    primaryBar: 'bg-[#586e75]',
    secondaryBar: 'bg-[#93a1a1]',
    accentBar: 'bg-[#268bd2]',
  },
  'black-grey': {
    wrapper: 'bg-[#0a0a0a] border-[#1f1f1f]',
    primaryBar: 'bg-neutral-200',
    secondaryBar: 'bg-neutral-500',
    accentBar: 'bg-blue-500',
  },
};

export default function SettingsView() {
  const { theme, setTheme } = useTheme();
  const synced = usePreferences();
  const [prefs, setPrefs] = useState<Preferences>(synced);
  const [saved, setSaved] = useState(false);

  // Reflect external preference changes (e.g. reset from another tab) into
  // local state so controls stay in sync with storage.
  useEffect(() => {
    setPrefs(synced);
  }, [synced]);

  const persist = (next: Preferences) => {
    setPrefs(next);
    writePreferences(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    persist({ ...prefs, [key]: value });
  };

  const togglePin = (slug: string) => {
    const nextPinned = prefs.pinnedServices.includes(slug)
      ? prefs.pinnedServices.filter((s) => s !== slug)
      : [...prefs.pinnedServices, slug];
    persist({ ...prefs, pinnedServices: nextPinned });
  };

  const resetAll = () => {
    clearPreferences();
    try {
      localStorage.removeItem('outage-map-alert-rules');
    } catch {
      /* ignore */
    }
    setPrefs(DEFAULT_PREFERENCES);
    setTheme('solarized-dark');
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Personalize the dashboard appearance, data refresh cadence, and pinned services."
        actions={
          saved && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Saved
            </span>
          )
        }
      />

      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-4">Appearance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEMES.map(({ value, label, description }) => (
            <button
              key={value}
              onClick={() => setTheme(value as Theme)}
              className={`relative rounded-xl p-4 border-2 text-left transition-colors ${
                theme === value ? 'border-accent' : 'border-subtle hover:border-strong'
              }`}
            >
              <div
                className={`h-20 rounded-lg mb-3 border ${THEME_PREVIEWS[value].wrapper}`}
              >
                <div className="p-2 space-y-1.5">
                  <div className={`h-2 w-12 rounded ${THEME_PREVIEWS[value].primaryBar}`} />
                  <div className={`h-2 w-20 rounded ${THEME_PREVIEWS[value].secondaryBar}`} />
                  <div className={`h-2 w-6 rounded ${THEME_PREVIEWS[value].accentBar}`} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{label}</span>
                {theme === value && (
                  <span className="text-xs text-accent-cyan">● Active</span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{description}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-4">Data & refresh</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Refresh interval</label>
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-surface border border-subtle">
              {([15, 30, 60, 300] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => update('refreshInterval', v)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs transition-all duration-150 ${
                    prefs.refreshInterval === v
                      ? 'bg-surface-elevated text-foreground font-semibold shadow-sm'
                      : 'font-medium text-muted hover:text-foreground'
                  }`}
                >
                  {v < 60 ? `${v}s` : `${v / 60}m`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              How often the overview polls for new status data.
            </p>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-subtle">
            <div>
              <p className="text-sm text-foreground">Show Downdetector reports</p>
              <p className="text-[11px] text-gray-500">Include crowd-sourced data alongside official statuses</p>
            </div>
            <button
              onClick={() => update('showDowndetector', !prefs.showDowndetector)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                prefs.showDowndetector ? 'bg-accent' : 'bg-white/10'
              }`}
              aria-label="Toggle Downdetector"
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  prefs.showDowndetector ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-subtle">
            <div>
              <p className="text-sm text-foreground">Compact service cards</p>
              <p className="text-[11px] text-gray-500">Denser layout on the overview page</p>
            </div>
            <button
              onClick={() => update('compactCards', !prefs.compactCards)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                prefs.compactCards ? 'bg-accent' : 'bg-white/10'
              }`}
              aria-label="Toggle compact"
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  prefs.compactCards ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Pinned services</h3>
            <p className="text-[11px] text-gray-500 mt-1">
              Pinned services appear first on the overview.
            </p>
          </div>
          <span className="text-xs text-gray-500">{prefs.pinnedServices.length} pinned</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SERVICES.map((s) => {
            const pinned = prefs.pinnedServices.includes(s.slug);
            return (
              <button
                key={s.slug}
                onClick={() => togglePin(s.slug)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                  pinned
                    ? 'border-accent bg-surface-elevated text-foreground shadow-sm'
                    : 'border-subtle text-muted hover:border-strong hover:text-foreground'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
                {pinned && <span className="text-accent-cyan">★</span>}
              </button>
            );
          })}
        </div>
      </Card>

      <Card elevated>
        <h3 className="text-sm font-semibold text-foreground mb-1">Reset preferences</h3>
        <p className="text-[11px] text-gray-500 mb-4">
          Clears stored preferences and alert rules on this device.
        </p>
        <button
          onClick={resetAll}
          className="px-4 py-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
        >
          Reset to defaults
        </button>
      </Card>
    </div>
  );
}
