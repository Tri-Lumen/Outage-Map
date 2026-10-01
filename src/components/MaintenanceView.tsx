'use client';

import { useState } from 'react';
import { useMaintenance } from '@/hooks/useMaintenance';
import { useServiceStatus } from '@/hooks/useStatus';
import { usePreferences } from '@/hooks/usePreferences';
import { formatInTimeZone } from '@/lib/format';
import { mutate } from 'swr';
import type { MaintenanceWindow } from '@/lib/types';
import { isWindowActiveAt, windowOverlapsRange } from '@/lib/maintenanceSchedule';

function formatDateTime(iso: string, tz?: string) {
  return formatInTimeZone(iso, tz, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }, iso);
}

function isActive(w: MaintenanceWindow) {
  return isWindowActiveAt(w, new Date());
}

export default function MaintenanceView() {
  const { data, isLoading } = useMaintenance();
  const { data: statusData } = useServiceStatus();
  const services = statusData?.services ?? [];
  const tz = usePreferences().timezone;

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    serviceSlugs: [] as string[],
    startTime: '',
    endTime: '',
    note: '',
    recurrence: 'none' as 'none' | 'weekly',
    recurrenceUntil: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'calendar'>('list');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceSlugs: form.serviceSlugs,
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
          note: form.note || null,
          recurrence: form.recurrence,
          recurrenceUntil: form.recurrence === 'weekly' && form.recurrenceUntil
            ? new Date(form.recurrenceUntil).toISOString()
            : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to create window');
        return;
      }
      await mutate('/api/maintenance');
      setCreating(false);
      setForm({ serviceSlugs: [], startTime: '', endTime: '', note: '', recurrence: 'none', recurrenceUntil: '' });
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this maintenance window?')) return;
    await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
    await mutate('/api/maintenance');
  }

  const windows = data?.windows ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted">
          {windows.length} window{windows.length !== 1 ? 's' : ''} scheduled
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-0.5 p-1 rounded-lg bg-surface border border-subtle">
            {(['list', 'calendar'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs rounded-md capitalize transition-colors ${
                  view === v ? 'bg-surface-elevated text-foreground font-semibold' : 'text-muted hover:text-foreground'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 rounded-lg bg-accent-soft text-foreground text-sm font-medium hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            + Schedule Window
          </button>
        </div>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="surface-card rounded-xl p-5 space-y-4 border border-subtle">
          <h3 className="font-semibold text-foreground">New Maintenance Window</h3>

          <div>
            <label className="block text-xs text-muted mb-1">Services (leave empty = all)</label>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <label key={s.slug} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.serviceSlugs.includes(s.slug)}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        serviceSlugs: e.target.checked
                          ? [...f.serviceSlugs, s.slug]
                          : f.serviceSlugs.filter((sl) => sl !== s.slug),
                      }));
                    }}
                    className="accent-cyan-400"
                  />
                  <span className="text-xs text-foreground">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">Start time</label>
              <input
                type="datetime-local"
                required
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="w-full px-3 py-1.5 rounded-lg surface-elevated border border-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">End time</label>
              <input
                type="datetime-local"
                required
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-full px-3 py-1.5 rounded-lg surface-elevated border border-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">Repeats</label>
              <select
                value={form.recurrence}
                onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value === 'weekly' ? 'weekly' : 'none' }))}
                className="w-full px-3 py-1.5 rounded-lg surface-elevated border border-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="none">One-time</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            {form.recurrence === 'weekly' && (
              <div>
                <label className="block text-xs text-muted mb-1">Repeat until (optional)</label>
                <input
                  type="date"
                  value={form.recurrenceUntil}
                  onChange={(e) => setForm((f) => ({ ...f, recurrenceUntil: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg surface-elevated border border-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Note (optional)</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Scheduled DB maintenance"
              className="w-full px-3 py-1.5 rounded-lg surface-elevated border border-subtle text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-accent-soft text-foreground text-sm font-medium disabled:opacity-50 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setError(''); }}
              className="px-4 py-2 rounded-lg text-muted text-sm hover:text-foreground hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="text-sm text-muted text-center py-8">Loading…</div>
      )}

      {view === 'calendar' && !isLoading && (
        <MaintenanceCalendar windows={windows} tz={tz} />
      )}

      {view === 'list' && !isLoading && windows.length === 0 && (
        <div className="text-center py-12 text-muted">
          <svg className="w-12 h-12 mx-auto mb-3 text-muted-strong" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
          <p>No maintenance windows scheduled.</p>
        </div>
      )}

      {view === 'list' && (
      <div className="space-y-3">
        {windows.map((w) => {
          const active = isActive(w);
          return (
            <div key={w.id} className={`surface-card rounded-xl p-4 border ${active ? 'border-amber-500/50' : 'border-subtle'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {active && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wide">Active</span>
                    )}
                    {w.recurrence === 'weekly' && (
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-muted text-[10px] font-semibold uppercase tracking-wide">
                        Weekly
                      </span>
                    )}
                    <span className="text-xs text-muted">
                      {w.serviceSlugs.length === 0 ? 'All services' : w.serviceSlugs.join(', ')}
                    </span>
                  </div>
                  <p className="text-sm text-foreground font-medium">
                    {formatDateTime(w.startTime, tz)} → {formatDateTime(w.endTime, tz)}
                  </p>
                  {w.recurrence === 'weekly' && (
                    <p className="text-xs text-muted mt-0.5">
                      Repeats weekly{w.recurrenceUntil ? ` until ${formatDateTime(w.recurrenceUntil, tz)}` : ''}
                    </p>
                  )}
                  {w.note && <p className="text-xs text-muted mt-1">{w.note}</p>}
                </div>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="text-muted hover:text-red-400 transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Delete window"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function MaintenanceCalendar({ windows, tz }: { windows: MaintenanceWindow[]; tz?: string }) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = startOfDay(new Date());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const windowsForDay = (day: Date) => {
    const ds = startOfDay(day);
    const de = new Date(ds.getTime() + 86400000 - 1);
    return windows.filter((w) => windowOverlapsRange(w, ds, de));
  };

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="surface-card rounded-xl p-4 border border-subtle">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="px-2 py-1 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label="Previous month"
          >‹</button>
          <button
            onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }}
            className="px-2.5 py-1 rounded-md text-xs text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >Today</button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="px-2 py-1 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label="Next month"
          >›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted mb-1">
        {DOW.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dayWindows = windowsForDay(day);
          const isToday = startOfDay(day).getTime() === today.getTime();
          const hasActive = dayWindows.some(isActive);
          return (
            <div
              key={i}
              className={`min-h-[64px] rounded-lg border p-1 ${
                hasActive
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : dayWindows.length
                    ? 'border-subtle bg-white/[0.02]'
                    : 'border-transparent'
              }`}
            >
              <div className={`text-[11px] mb-1 ${isToday ? 'text-accent font-bold' : 'text-muted-strong'}`}>{day.getDate()}</div>
              <div className="space-y-0.5">
                {dayWindows.slice(0, 3).map((w) => (
                  <div
                    key={w.id}
                    title={`${formatDateTime(w.startTime, tz)} → ${formatDateTime(w.endTime, tz)}${w.note ? ' · ' + w.note : ''}`}
                    className="truncate text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-300"
                  >
                    {w.serviceSlugs.length === 0 ? 'All services' : w.serviceSlugs.join(', ')}
                  </div>
                ))}
                {dayWindows.length > 3 && (
                  <div className="text-[9px] text-muted">+{dayWindows.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
