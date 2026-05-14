import TileChrome from './TileChrome';
import { relTime } from '@/lib/boardColors';
import { useIncidents } from '@/hooks/useStatus';
import type { TileProps } from './types';

const SEV_COLOR: Record<string, string> = {
  critical: '#EF5350',
  major:    '#EF5350',
  minor:    '#FFD54F',
  warning:  '#FFB74D',
  resolved: '#7CB342',
};

export default function IncidentFeedTile({ config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure, live }: TileProps) {
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
    </TileChrome>
  );
}
