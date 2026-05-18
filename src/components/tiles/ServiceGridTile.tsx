import TileChrome from './TileChrome';
import { getStatusColor } from '@/lib/boardColors';
import type { TileProps } from './types';

export default function ServiceGridTile({ config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure, live }: TileProps) {
  const filterSlugs = config.services as string[] | undefined;
  const filters = (config.filters ?? {}) as { hideOperational?: boolean };
  let shown = filterSlugs?.length
    ? live.services.filter((s) => filterSlugs.includes(s.slug))
    : live.services;
  if (filters.hideOperational) {
    shown = shown.filter((s) => s.overallStatus !== 'operational');
  }

  const counts = {
    operational: shown.filter((s) => s.overallStatus === 'operational').length,
    degraded:    shown.filter((s) => s.overallStatus === 'degraded').length,
    outage:      shown.filter((s) => s.overallStatus === 'major_outage' || s.overallStatus === 'down').length,
  };

  const statusBadge = (
    <div style={{ display: 'flex', gap: 4 }}>
      {counts.outage > 0 && (
        <span className="count-pill" style={{ background: 'rgba(239,83,80,0.18)', color: '#EF5350' }}>
          {counts.outage} down
        </span>
      )}
      {counts.degraded > 0 && (
        <span className="count-pill" style={{ background: 'rgba(255,213,79,0.18)', color: '#FFD54F' }}>
          {counts.degraded} degraded
        </span>
      )}
      {counts.outage === 0 && counts.degraded === 0 && (
        <span className="count-pill">{shown.length}</span>
      )}
    </div>
  );

  return (
    <TileChrome
      title="Service Grid"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      }
      badge={statusBadge}
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
      {shown.length > 0 && (counts.degraded > 0 || counts.outage > 0) && (
        <div style={{ fontSize: 11, color: 'var(--muted-strong)', marginBottom: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
          {counts.operational} operational
          {counts.degraded > 0 && <span style={{ color: '#FFD54F' }}> · {counts.degraded} degraded</span>}
          {counts.outage > 0 && <span style={{ color: '#EF5350' }}> · {counts.outage} down</span>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, overflowY: 'auto', flex: 1 }}>
        {shown.map((s) => {
          const c = getStatusColor(s.overallStatus);
          return (
            <div key={s.slug} className="mini-service">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: s.color,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 9,
                  flexShrink: 0,
                }}
              >
                {s.name.substring(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot, display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: c.text }}>{c.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </TileChrome>
  );
}
