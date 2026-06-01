'use client';

import { useEffect, useState } from 'react';
import { useServiceStatus } from '@/hooks/useStatus';
import {
  DEFAULT_PREFERENCES,
  Preferences,
  clearPreferences,
  usePreferences,
  writePreferences,
} from '@/hooks/usePreferences';
import { useTheme, THEMES, type Theme } from './ThemeProvider';
import { listTimeZones } from '@/lib/format';
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
  'midnight': {
    wrapper: 'bg-[#0b1220] border-[#1e2d45]',
    primaryBar: 'bg-[#cbd5e1]',
    secondaryBar: 'bg-[#64748b]',
    accentBar: 'bg-[#38bdf8]',
  },
  'auto': {
    wrapper: 'bg-gradient-to-br from-[#0a0a0a] to-[#fdf6e3] border-neutral-500',
    primaryBar: 'bg-neutral-300',
    secondaryBar: 'bg-neutral-500',
    accentBar: 'bg-[#268bd2]',
  },
  'custom': {
    wrapper: 'bg-[var(--surface)] border-[var(--border-strong)]',
    primaryBar: 'bg-[var(--foreground)]',
    secondaryBar: 'bg-[var(--muted)]',
    accentBar: 'bg-[var(--accent)]',
  },
  'ocean': {
    wrapper: 'bg-[#0a1628] border-[#1a2e4a]',
    primaryBar: 'bg-[#cdd9e5]',
    secondaryBar: 'bg-[#5a7a9a]',
    accentBar: 'bg-[#00b4d8]',
  },
  'forest': {
    wrapper: 'bg-[#0d1f0d] border-[#1a3a1a]',
    primaryBar: 'bg-[#c8e6c9]',
    secondaryBar: 'bg-[#5a8a5a]',
    accentBar: 'bg-[#52b788]',
  },
  'corporate': {
    wrapper: 'bg-[#f4f6f9] border-[#d1d9e0]',
    primaryBar: 'bg-[#1a2436]',
    secondaryBar: 'bg-[#64748b]',
    accentBar: 'bg-[#2563eb]',
  },
};

export default function SettingsView() {
  const { theme, setTheme } = useTheme();
  const synced = usePreferences();
  const [prefs, setPrefs] = useState<Preferences>(synced);
  const [saved, setSaved] = useState(false);
  const { data: statusData } = useServiceStatus();
  const services = statusData?.services ?? [];
  const timezones = listTimeZones();
  const [anomalyCfg, setAnomalyCfg] = useState<{ threshold: number; minPoints: number } | null>(null);
  const [anomalyMsg, setAnomalyMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/anomaly')
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.threshold === 'number') setAnomalyCfg({ threshold: d.threshold, minPoints: d.minPoints });
      })
      .catch(() => {});
  }, []);

  const saveAnomaly = async () => {
    if (!anomalyCfg) return;
    setAnomalyMsg(null);
    try {
      const res = await fetch('/api/settings/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(anomalyCfg),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setAnomalyCfg({ threshold: body.threshold, minPoints: body.minPoints });
        setAnomalyMsg('Saved ✓');
      } else {
        setAnomalyMsg(body.error || `Failed (HTTP ${res.status})`);
      }
    } catch {
      setAnomalyMsg('Network error');
    }
  };

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

  const setServiceSla = (slug: string, value: number | null) => {
    const next = { ...(prefs.slaTargets ?? {}) };
    if (value === null) delete next[slug];
    else next[slug] = value;
    persist({ ...prefs, slaTargets: next });
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
              aria-pressed={theme === value}
              className={`relative rounded-xl p-4 border-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
              <p className="text-[11px] text-muted mt-1">{description}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-4">Data & refresh</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-muted mb-2">Refresh interval</label>
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
            <p className="text-[11px] text-muted mt-1.5">
              How often the overview polls for new status data.
            </p>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-subtle">
            <div>
              <p className="text-sm text-foreground">Show Downdetector reports</p>
              <p className="text-[11px] text-muted-strong">Include crowd-sourced data alongside official statuses. Thresholds are configured server-side via <code className="text-foreground">DD_REPORT_THRESHOLD_DEGRADED</code> and <code className="text-foreground">DD_REPORT_THRESHOLD_MAJOR</code>.</p>
            </div>
            <button
              role="switch"
              aria-checked={prefs.showDowndetector}
              onClick={() => update('showDowndetector', !prefs.showDowndetector)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                prefs.showDowndetector ? 'bg-accent' : 'bg-white/10'
              }`}
              aria-label="Toggle Downdetector"
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  prefs.showDowndetector ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-subtle">
            <div>
              <p className="text-sm text-foreground">Compact service cards</p>
              <p className="text-[11px] text-muted">Denser layout on the overview page</p>
            </div>
            <button
              role="switch"
              aria-checked={prefs.compactCards}
              onClick={() => update('compactCards', !prefs.compactCards)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                prefs.compactCards ? 'bg-accent' : 'bg-white/10'
              }`}
              aria-label="Toggle compact"
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  prefs.compactCards ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-subtle">
            <div>
              <p className="text-sm text-foreground">Color-blind palette</p>
              <p className="text-[11px] text-muted">Use a color-blind-safe set of status colors across the app</p>
            </div>
            <button
              role="switch"
              aria-checked={prefs.colorBlind}
              onClick={() => update('colorBlind', !prefs.colorBlind)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                prefs.colorBlind ? 'bg-accent' : 'bg-white/10'
              }`}
              aria-label="Toggle color-blind palette"
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  prefs.colorBlind ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-subtle">
            <div>
              <p className="text-sm text-foreground">Time zone</p>
              <p className="text-[11px] text-muted">How absolute timestamps are displayed across the app</p>
            </div>
            <select
              value={prefs.timezone}
              onChange={(e) => update('timezone', e.target.value)}
              className="px-2 py-1.5 rounded-md bg-white/5 border border-subtle text-sm text-foreground focus:outline-none focus:border-accent max-w-[220px]"
              aria-label="Time zone"
            >
              <option value="">Browser default</option>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-subtle">
            <div>
              <p className="text-sm text-foreground">SLA target</p>
              <p className="text-[11px] text-muted">Uptime % threshold for compliance badges in Analytics</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={90}
                max={100}
                step={0.01}
                value={prefs.slaTarget ?? 99.9}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 90 && v <= 100) update('slaTarget', v);
                }}
                className="w-20 px-2 py-1.5 rounded-md bg-white/5 border border-subtle text-sm text-foreground text-right focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-muted">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-subtle">
            <div>
              <p className="text-sm text-foreground">Downtime cost</p>
              <p className="text-[11px] text-muted">Estimated cost per hour of downtime, used by the Analytics cost calculator. Set 0 to hide.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">$</span>
              <input
                type="number"
                min={0}
                step={100}
                value={prefs.costPerHour ?? 0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  update('costPerHour', isNaN(v) || v < 0 ? 0 : v);
                }}
                className="w-28 px-2 py-1.5 rounded-md bg-white/5 border border-subtle text-sm text-foreground text-right focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-muted">/hr</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Pinned services</h3>
            <p className="text-[11px] text-muted mt-1">
              Pinned services appear first on the overview.
            </p>
          </div>
          <span className="text-xs text-muted">{prefs.pinnedServices.length} pinned</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => {
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

      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Per-service SLA targets</h3>
            <p className="text-[11px] text-muted mt-1">
              Override the global {prefs.slaTarget ?? 99.9}% target for specific services. Leave blank to use the global target.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {services.map((s) => {
            const override = prefs.slaTargets?.[s.slug];
            return (
              <div key={s.slug} className="flex items-center justify-between py-1.5 border-b border-subtle/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm text-foreground truncate">{s.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={90}
                    max={100}
                    step={0.01}
                    placeholder={String(prefs.slaTarget ?? 99.9)}
                    value={override ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') { setServiceSla(s.slug, null); return; }
                      const v = parseFloat(raw);
                      if (!isNaN(v) && v >= 90 && v <= 100) setServiceSla(s.slug, v);
                    }}
                    className="w-20 px-2 py-1 rounded-md bg-white/5 border border-subtle text-xs text-foreground text-right focus:outline-none focus:border-accent"
                    aria-label={`SLA target for ${s.name}`}
                  />
                  <span className="text-[11px] text-muted">%</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-1">Anomaly detection</h3>
        <p className="text-[11px] text-muted mb-4">
          Tune Downdetector spike sensitivity. Applies server-side on the next poll. Saving requires the settings API to be enabled (ENABLE_RULES_API or CRON_SECRET).
        </p>
        {anomalyCfg ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Z-score threshold</p>
                <p className="text-[11px] text-muted">Higher = fewer, stronger anomalies (default 2.5)</p>
              </div>
              <input
                type="number"
                min={1}
                max={10}
                step={0.1}
                value={anomalyCfg.threshold}
                onChange={(e) => setAnomalyCfg({ ...anomalyCfg, threshold: parseFloat(e.target.value) || anomalyCfg.threshold })}
                className="w-24 px-2 py-1.5 rounded-md bg-white/5 border border-subtle text-sm text-foreground text-right focus:outline-none focus:border-accent"
                aria-label="Z-score threshold"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Minimum data points</p>
                <p className="text-[11px] text-muted">History points required before scoring (default 24)</p>
              </div>
              <input
                type="number"
                min={3}
                max={200}
                step={1}
                value={anomalyCfg.minPoints}
                onChange={(e) => setAnomalyCfg({ ...anomalyCfg, minPoints: parseInt(e.target.value) || anomalyCfg.minPoints })}
                className="w-24 px-2 py-1.5 rounded-md bg-white/5 border border-subtle text-sm text-foreground text-right focus:outline-none focus:border-accent"
                aria-label="Minimum data points"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveAnomaly}
                className="px-4 py-2 rounded-md bg-accent-soft text-foreground text-xs font-medium hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Save anomaly settings
              </button>
              {anomalyMsg && <span className="text-[11px] text-muted">{anomalyMsg}</span>}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted">Loading…</p>
        )}
      </Card>

      <Card elevated>
        <h3 className="text-sm font-semibold text-foreground mb-1">Reset preferences</h3>
        <p className="text-[11px] text-muted mb-4">
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
