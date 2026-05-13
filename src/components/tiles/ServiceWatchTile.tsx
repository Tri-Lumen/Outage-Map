import TileChrome from './TileChrome';
import Sparkline from '../Sparkline';
import { getStatusColor, historyToSparkline } from '@/lib/boardColors';
import type { LiveData } from './types';

interface Props {
  config: { service?: string; label?: string };
  editing?: boolean;
  dataPoints: string[];
  toggleDataPoint: (key: string) => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
  onResize?: () => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  onRename?: (label: string | null) => void;
  live: LiveData;
}

function StatusDot({ status, pulse = false }: { status: string; pulse?: boolean }) {
  const c = getStatusColor(status);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: c.dot,
          boxShadow: pulse ? `0 0 0 4px ${c.bg}` : 'none',
          animation: pulse && status !== 'operational' ? 'pulse-ring 2s ease-in-out infinite' : 'none',
          display: 'inline-block',
        }}
      />
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = getStatusColor(status);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        letterSpacing: 0.2,
      }}
    >
      <StatusDot status={status} pulse />
      {c.label}
    </span>
  );
}

export default function ServiceWatchTile({
  config,
  editing,
  dataPoints,
  toggleDataPoint,
  onConfigChange,
  onResize,
  onRemove,
  onDuplicate,
  onRename,
  live,
}: Props) {
  const slug = (config.service as string) || '';
  const svc = live.services.find((s) => s.slug === slug) || live.services[0];

  if (!svc) {
    return (
      <TileChrome
        title="Service Watch"
        label={config.label ?? null}
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

  const status = svc.overallStatus;
  const c = getStatusColor(status);
  const hist = live.history[svc.slug] || [];
  const sparkData = historyToSparkline(hist as Parameters<typeof historyToSparkline>[0]);

  const showSpark = dataPoints.includes('sparkline');
  const showDD = dataPoints.includes('downdetector');
  const showUptime = dataPoints.includes('uptime');
  const showOfficial = dataPoints.includes('official');

  const uptimePct =
    hist.length > 0
      ? ((hist.filter((p) => p.status === 'operational').length / hist.length) * 100).toFixed(2)
      : '—';

  return (
    <TileChrome
      title={svc.name}
      icon={
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: svc.color,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 9,
            flexShrink: 0,
          }}
        >
          {svc.name.substring(0, 2).toUpperCase()}
        </div>
      }
      label={config.label ?? null}
      editing={editing}
      onResize={onResize}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      onRename={onRename}
      onConfigure={() => {
        const next = live.services[(live.services.findIndex((s) => s.slug === svc.slug) + 1) % live.services.length];
        if (next) onConfigChange({ service: next.slug });
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <StatusBadge status={status} />
            {svc.details && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                {svc.details}
              </p>
            )}
          </div>
          {showUptime && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground-strong, var(--foreground))', fontVariantNumeric: 'tabular-nums' }}>
                {uptimePct}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted-strong)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                30d uptime
              </div>
            </div>
          )}
        </div>

        {showSpark && sparkData.length > 0 && (
          <div style={{ marginTop: 'auto' }}>
            <Sparkline data={sparkData} color={c.dot} height={36} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted-strong)', marginTop: 4 }}>
              <span>30 days ago</span>
              <span>now</span>
            </div>
          </div>
        )}

        {(showDD || showOfficial) && (
          <div
            style={{
              display: 'flex',
              gap: 16,
              fontSize: 11,
              color: 'var(--muted)',
              paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            {showOfficial && (
              <div>
                <span style={{ color: 'var(--muted-strong)' }}>Official </span>
                <span style={{ color: getStatusColor(svc.officialStatus).text }}>
                  {getStatusColor(svc.officialStatus).label}
                </span>
              </div>
            )}
            {showDD && (
              <div>
                <span style={{ color: 'var(--muted-strong)' }}>DD </span>
                <span
                  style={{
                    color:
                      svc.downdetectorReports > 500
                        ? '#EF5350'
                        : svc.downdetectorReports > 100
                        ? '#FFD54F'
                        : 'var(--foreground)',
                    fontWeight: 600,
                  }}
                >
                  {svc.downdetectorReports.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {editing && (
          <div className="datapoint-chips">
            {[
              ['sparkline', '30d chart'],
              ['uptime', 'Uptime %'],
              ['official', 'Official'],
              ['downdetector', 'DD reports'],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => toggleDataPoint(k)}
                className={`chip ${dataPoints.includes(k) ? 'chip-on' : ''}`}
              >
                {dataPoints.includes(k) ? '●' : '○'} {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </TileChrome>
  );
}
