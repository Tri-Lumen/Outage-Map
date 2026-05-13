import TileChrome from './TileChrome';
import { relTime } from '@/lib/boardColors';
import { useIncidents } from '@/hooks/useStatus';
import type { TileProps } from './types';
import RefreshSelect from './RefreshSelect';

const SEV_COLOR: Record<string, string> = {
  critical: '#EF5350',
  major:    '#EF5350',
  minor:    '#FFD54F',
  warning:  '#FFB74D',
  resolved: '#7CB342',
};

const SEVERITIES = ['critical', 'major', 'minor'] as const;
const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;

export default function IncidentFeedTile({ config, editing, onConfigChange, onResize, onRemove, onDuplicate, onRename, live }: TileProps) {
  const refreshMs = typeof config.refreshMs === 'number' ? config.refreshMs : undefined;
  const override = useIncidents(7, refreshMs);
  const allIncidents = refreshMs && override.data ? override.data.incidents : live.incidents;
  const services = live.services;

  const filters = (config.filters ?? {}) as {
    severity?: string[];
    statuses?: string[];
    services?: string[];
  };
  const incidents = allIncidents.filter((i) => {
    if (filters.severity && filters.severity.length && !filters.severity.includes(i.severity)) return false;
    if (filters.statuses && filters.statuses.length && !filters.statuses.includes(i.status)) return false;
    if (filters.services && filters.services.length && !filters.services.includes(i.service)) return false;
    return true;
  });
  const activeCount = incidents.filter((i) => i.status !== 'resolved').length;

  const toggleFilter = (key: 'severity' | 'statuses' | 'services', value: string) => {
    const current = filters[key] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onConfigChange({ filters: { ...filters, [key]: next.length ? next : undefined } });
  };

  return (
    <TileChrome
      title="Incident Feed"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
        </svg>
      }
      badge={
        <span
          className="count-pill"
          style={{ background: 'rgba(239,83,80,0.18)', color: '#EF5350' }}
        >
          {activeCount} active
        </span>
      }
      label={typeof config.label === 'string' ? config.label : null}
      editing={editing}
      onResize={onResize}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      onRename={onRename}
    >
      <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
        {incidents.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>No incidents.</div>
        ) : (
          incidents.map((inc) => {
            const svc = services.find((s) => s.slug === inc.service);
            const sevKey = inc.severity === 'critical' ? 'critical' : inc.severity;
            const color = SEV_COLOR[inc.status === 'resolved' ? 'resolved' : sevKey] ?? '#FFD54F';
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
                </div>
              </div>
            );
          })
        )}
      </div>
      {editing && (
        <div className="tile-filters">
          <div className="tile-filter-group">
            <span className="tile-filter-label">Severity</span>
            {SEVERITIES.map((s) => (
              <button
                key={s}
                className={`chip ${filters.severity?.includes(s) ? 'chip-on' : ''}`}
                onClick={() => toggleFilter('severity', s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="tile-filter-group">
            <span className="tile-filter-label">Status</span>
            {STATUSES.map((s) => (
              <button
                key={s}
                className={`chip ${filters.statuses?.includes(s) ? 'chip-on' : ''}`}
                onClick={() => toggleFilter('statuses', s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {editing && (
        <RefreshSelect
          value={refreshMs}
          onChange={(ms) => onConfigChange({ refreshMs: ms })}
        />
      )}
    </TileChrome>
  );
}
