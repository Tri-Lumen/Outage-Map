import TileChrome from './TileChrome';
import type { TileProps } from './types';

type MetricKey = 'uptime' | 'incidents' | 'dd' | 'mttr';

export default function BoardStatTile({ config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure, live }: TileProps) {
  const metric = (config.metric as MetricKey) || 'uptime';
  const { services, incidents } = live;

  const operational = services.filter((s) => s.overallStatus === 'operational').length;
  const total = services.length;
  const activeIncidents = incidents.filter((i) => i.status !== 'resolved').length;
  const totalDD = services.reduce((sum, s) => sum + (s.downdetectorReports || 0), 0);
  const uptimePct = total > 0 ? ((operational / total) * 100).toFixed(1) : '0.0';

  const metrics: Record<MetricKey, { label: string; value: string | number; sub: string; accent: string }> = {
    uptime:    { label: 'Fleet Uptime',     value: `${uptimePct}%`,           sub: `${operational}/${total} services healthy`, accent: '#7CB342' },
    incidents: { label: 'Active Incidents', value: activeIncidents,           sub: `${incidents.length} total in view`,         accent: '#FFD54F' },
    dd:        { label: 'DD Reports',       value: totalDD.toLocaleString(),  sub: 'Aggregated across services',                 accent: '#2aa198' },
    mttr:      { label: 'MTTR (30d)',       value: '38m',                     sub: 'Mean time to recovery',                     accent: '#268bd2' },
  };

  const m = metrics[metric] ?? metrics.uptime;

  return (
    <TileChrome
      title={m.label}
      label={typeof config.label === 'string' ? config.label : null}
      editing={editing}
      onResize={onResize}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      onRename={onRename}
      onConfigure={onConfigure}
    >
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 4 }}>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: m.accent,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            letterSpacing: -0.5,
          }}
        >
          {m.value}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.sub}</div>
      </div>

    </TileChrome>
  );
}
