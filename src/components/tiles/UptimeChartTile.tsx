import TileChrome from './TileChrome';
import Sparkline from '../Sparkline';
import { getStatusColor, historyToSparkline } from '@/lib/boardColors';
import type { TileProps } from './types';

type RangeDays = 7 | 30 | 90;

export default function UptimeChartTile({ config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure, live }: TileProps) {
  const slug = (config.service as string) || '';
  const svc = live.services.find((s) => s.slug === slug) ?? live.services[0];
  const filters = (config.filters ?? {}) as { rangeDays?: RangeDays };
  const rangeDays: RangeDays = filters.rangeDays ?? 30;

  if (!svc) {
    return (
      <TileChrome
        title="Uptime Chart"
        label={typeof config.label === 'string' ? config.label : null}
        iconText={typeof config.icon === 'string' ? config.icon : null}
        tag={typeof config.tag === 'string' ? config.tag : null}
        editing={editing}
        onResize={onResize}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        onRename={onRename}
      >
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>No service data</div>
      </TileChrome>
    );
  }

  const fullHist = live.history[svc.slug] ?? [];
  const hist = fullHist.slice(-rangeDays);
  const sparkData = historyToSparkline(hist as Parameters<typeof historyToSparkline>[0]);
  const c = getStatusColor(svc.overallStatus);
  const uptimePct =
    hist.length > 0
      ? ((hist.filter((p) => p.status === 'operational').length / hist.length) * 100).toFixed(2)
      : '—';

  const today = new Date();
  const rangeAgo = new Date(today);
  rangeAgo.setDate(today.getDate() - rangeDays);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <TileChrome
      title={`${svc.name} — ${rangeDays} day`}
      icon={
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            background: svc.color,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 8,
            flexShrink: 0,
          }}
        >
          {svc.name.substring(0, 2).toUpperCase()}
        </div>
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
            {uptimePct}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-strong)' }}>uptime over {rangeDays} days</div>
        </div>
        <div style={{ flex: 1, minHeight: 60 }}>
          {sparkData.length > 0 ? (
            <Sparkline data={sparkData} color={c.dot} height={80} />
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>No history data</div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted-strong)' }}>
          <span>{fmt(rangeAgo)}</span>
          <span>{fmt(today)}</span>
        </div>
      </div>
    </TileChrome>
  );
}
