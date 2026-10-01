import { useCallback, useMemo } from 'react';
import TileChrome from './TileChrome';
import { relTime } from '@/lib/boardColors';
import { useIncidents } from '@/hooks/useStatus';
import { getDependentServices } from '@/lib/serviceDependencies';
import type { TileProps } from './types';

function dayLabel(iso: string | null): string {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (day.getTime() === today.getTime()) return 'Today';
  if (day.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const SEV_COLOR: Record<string, string> = {
  critical: '#EF5350',
  major:    '#EF5350',
  minor:    '#FFD54F',
  warning:  '#FFB74D',
  resolved: '#7CB342',
};

export default function IncidentFeedTile({ config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure, live }: TileProps) {
  const refreshMs = typeof config.refreshMs === 'number' ? config.refreshMs : undefined;
  const filters = (config.filters ?? {}) as {
    severity?: string[];
    statuses?: string[];
    services?: string[];
    days?: number;
  };
  const days = typeof filters.days === 'number' ? filters.days : 7;
  const override = useIncidents(days, refreshMs);
  const allIncidents = override.data ? override.data.incidents : live.incidents;
  const services = live.services;
  const incidents = allIncidents.filter((i) => {
    if (filters.severity && filters.severity.length && !filters.severity.includes(i.severity)) return false;
    if (filters.statuses && filters.statuses.length && !filters.statuses.includes(i.status)) return false;
    if (filters.services && filters.services.length && !filters.services.includes(i.service)) return false;
    return true;
  });
  const activeCount = incidents.filter((i) => i.status !== 'resolved').length;

  const exportCsv = useCallback(() => {
    const headers = ['ID', 'Service', 'Title', 'Severity', 'Status', 'Started', 'Resolved'];
    const rows = incidents.map((inc) => [
      inc.id,
      services.find((s) => s.slug === inc.service)?.name ?? inc.service,
      `"${(inc.title || '').replace(/"/g, '""')}"`,
      inc.severity,
      inc.status,
      inc.startedAt ?? '',
      inc.resolvedAt ?? '',
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'incidents.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [incidents, services]);

  const grouped = useMemo(() => {
    const groups: { day: string; items: typeof incidents }[] = [];
    for (const inc of incidents) {
      const label = dayLabel(inc.startedAt);
      const last = groups[groups.length - 1];
      if (last && last.day === label) {
        last.items.push(inc);
      } else {
        groups.push({ day: label, items: [inc] });
      }
    }
    return groups;
  }, [incidents]);

  return (
    <TileChrome
      title="Incident Feed"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
        </svg>
      }
      badge={
        <>
          <span
            className="count-pill"
            style={{ background: 'rgba(239,83,80,0.18)', color: '#EF5350' }}
          >
            {activeCount} active
          </span>
          {incidents.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); exportCsv(); }}
              title="Export the filtered incidents as CSV"
              aria-label="Export incidents as CSV"
              style={{ display: 'inline-flex', alignItems: 'center', padding: 2, marginLeft: 4, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
          )}
        </>
      }
      label={typeof config.label === 'string' ? config.label : null}
      iconText={typeof config.icon === 'string' ? config.icon : null}
      tag={typeof config.tag === 'string' ? config.tag : null}
      editing={editing}
      onResize={onResize}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      onRename={onRename}
      onConfigure={onConfigure}
    >
      <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
        {incidents.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>No incidents.</div>
        ) : (
          grouped.map(({ day, items }) => (
            <div key={day}>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                padding: '6px 0 3px',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: 2,
              }}>
                {day}
              </div>
              {items.map((inc) => {
                const svc = services.find((s) => s.slug === inc.service);
                const sevKey = inc.severity === 'critical' ? 'critical' : inc.severity;
                const color = SEV_COLOR[inc.status === 'resolved' ? 'resolved' : sevKey] ?? '#FFD54F';
                const dependents = inc.status !== 'resolved' ? getDependentServices(inc.service) : [];
                return (
                  <div key={inc.id} className="incident-row">
                    <div style={{ width: 3, alignSelf: 'stretch', background: color, borderRadius: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {inc.severity}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted-strong)' }}>·</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{svc?.name ?? inc.service}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted-strong)', marginLeft: 'auto' }}>
                          {relTime(inc.startedAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--foreground)', lineHeight: 1.4 }}>{inc.title}</div>
                      {dependents.length > 0 && (
                        <div style={{ fontSize: 10, color: '#FFB74D', marginTop: 2 }}>
                          ⚠ May cascade to {dependents.length} dependent service{dependents.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </TileChrome>
  );
}
