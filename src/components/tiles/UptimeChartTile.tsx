import TileChrome from './TileChrome';
import Sparkline from '../Sparkline';
import { getStatusColor, historyToSparkline } from '@/lib/boardColors';
import type { TileProps } from './types';

export default function UptimeChartTile({ config, editing, onResize, onRemove, live }: TileProps) {
  const slug = (config.service as string) || '';
  const svc = live.services.find((s) => s.slug === slug) ?? live.services[0];

  if (!svc) {
    return (
      <TileChrome title="Uptime Chart" editing={editing} onResize={onResize} onRemove={onRemove}>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>No service data</div>
      </TileChrome>
    );
  }

  const hist = live.history[svc.slug] ?? [];
  const sparkData = historyToSparkline(hist as Parameters<typeof historyToSparkline>[0]);
  const c = getStatusColor(svc.overallStatus);
  const uptimePct =
    hist.length > 0
      ? ((hist.filter((p) => p.status === 'operational').length / hist.length) * 100).toFixed(2)
      : '—';

  const today = new Date();
  const thirtyAgo = new Date(today);
  thirtyAgo.setDate(today.getDate() - 30);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <TileChrome
      title={`${svc.name} — 30 day`}
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
      editing={editing}
      onResize={onResize}
      onRemove={onRemove}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
            {uptimePct}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-strong)' }}>uptime over 30 days</div>
        </div>
        <div style={{ flex: 1, minHeight: 60 }}>
          {sparkData.length > 0 ? (
            <Sparkline data={sparkData} color={c.dot} height={80} />
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>No history data</div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted-strong)' }}>
          <span>{fmt(thirtyAgo)}</span>
          <span>{fmt(today)}</span>
        </div>
      </div>
    </TileChrome>
  );
}
