import { useMemo } from 'react';
import TileChrome from './TileChrome';
import type { TileProps } from './types';
import type { HistoryPoint } from '@/lib/types';
import { usePreferences } from '@/hooks/usePreferences';

type MetricKey = 'uptime' | 'incidents' | 'dd' | 'mttr' | 'sla';

function mttrForService(points: HistoryPoint[]): number {
  const affected = points.filter((p) => p.outageMinutes > 0);
  if (!affected.length) return 0;
  return affected.reduce((s, p) => s + p.outageMinutes, 0) / affected.length;
}

export default function BoardStatTile({ config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure, live }: TileProps) {
  const metric = (config.metric as MetricKey) || 'uptime';
  const { services, incidents } = live;
  const prefs = usePreferences();
  const slaTarget = prefs.slaTarget ?? 99.9;

  const operational = services.filter((s) => s.overallStatus === 'operational').length;
  const total = services.length;
  const activeIncidents = incidents.filter((i) => i.status !== 'resolved').length;
  const totalDD = services.reduce((sum, s) => sum + (s.downdetectorReports || 0), 0);
  const uptimePct = total > 0 ? ((operational / total) * 100).toFixed(1) : '0.0';

  const mttrDisplay = useMemo(() => {
    const slugMttrs = Object.values(live.history).map(mttrForService).filter((m) => m > 0);
    if (!slugMttrs.length) return '—';
    const avg = Math.round(slugMttrs.reduce((s, m) => s + m, 0) / slugMttrs.length);
    return avg < 60 ? `${avg}m` : `${Math.round(avg / 60)}h`;
  }, [live.history]);

  const slaCompliance = useMemo(() => {
    const pts = Object.values(live.history);
    if (!pts.length) return { meeting: 0, total: 0 };
    const slugs = Object.keys(live.history);
    let meeting = 0;
    for (const slug of slugs) {
      const points = live.history[slug] || [];
      if (!points.length) { meeting++; continue; }
      const totalMin = points.length * 24 * 60;
      const downMin = points.reduce((s, p) => s + (p.outageMinutes || 0), 0);
      const uptime = ((totalMin - downMin) / totalMin) * 100;
      if (uptime >= slaTarget) meeting++;
    }
    return { meeting, total: slugs.length };
  }, [live.history, slaTarget]);

  const metrics: Record<MetricKey, { label: string; value: string | number; sub: string; accent: string }> = {
    uptime:    { label: 'Fleet Uptime',     value: `${uptimePct}%`,                sub: `${operational}/${total} services healthy`,          accent: '#7CB342' },
    incidents: { label: 'Active Incidents', value: activeIncidents,                sub: `${incidents.length} total in view`,                  accent: '#FFD54F' },
    dd:        { label: 'DD Reports',       value: totalDD.toLocaleString(),       sub: 'Aggregated across services',                         accent: '#2aa198' },
    mttr:      { label: 'MTTR (30d)',       value: mttrDisplay,                   sub: mttrDisplay === '—' ? 'No outage data' : 'Mean time to recovery', accent: '#268bd2' },
    sla:       { label: 'SLA Compliance',   value: `${slaCompliance.meeting}/${slaCompliance.total}`, sub: `≥${slaTarget}% uptime target`, accent: slaCompliance.meeting === slaCompliance.total ? '#7CB342' : '#FFD54F' },
  };

  const m = metrics[metric] ?? metrics.uptime;

  return (
    <TileChrome
      title={m.label}
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
