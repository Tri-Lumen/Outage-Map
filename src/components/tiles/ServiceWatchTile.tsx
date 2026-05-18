import TileChrome from './TileChrome';
import Sparkline from '../Sparkline';
import { getStatusColor, historyToSparkline } from '@/lib/boardColors';
import { useServiceStatus } from '@/hooks/useStatus';
import type { LiveData } from './types';

interface Props {
  config: {
    service?: string;
    label?: string;
    refreshMs?: number;
    icon?: string;
    tag?: string;
    accent?: string;
  };
  editing?: boolean;
  dataPoints: string[];
  toggleDataPoint: (key: string) => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
  onResize?: () => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  onRename?: (label: string | null) => void;
  onConfigure?: () => void;
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
  onConfigure,
  live,
}: Props) {
  void onConfigChange;
  const refreshMs = config.refreshMs;
  const override = useServiceStatus(refreshMs);
  const services = refreshMs && override.data ? override.data.services : live.services;
  const slug = (config.service as string) || '';
  const svc = services.find((s) => s.slug === slug) || services[0];
  // toggleDataPoint kept for the parent's onConfigChange API symmetry, but
  // the inline chip UI has moved to the config drawer.
  void toggleDataPoint;

  if (!svc) {
    return (
      <TileChrome
        title="Service Watch"
        label={config.label ?? null}
        iconText={typeof config.icon === 'string' ? config.icon : null}
        tag={typeof config.tag === 'string' ? config.tag : null}
        editing={editing}
        onResize={onResize}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        onRename={onRename}
        onConfigure={onConfigure}
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

  const lastIssueIdx = hist.length
    ? [...hist].reverse().findIndex((p) => p.status !== 'operational' || p.outageMinutes > 0)
    : -1;

  let stabilityText: string | null = null;
  if (hist.length) {
    if (lastIssueIdx === -1) stabilityText = `Stable ${hist.length}d`;
    else if (lastIssueIdx === 0) stabilityText = 'Issue today';
    else stabilityText = `Last issue ${lastIssueIdx}d ago`;
  }

  let stabilityColor = 'var(--muted)';
  if (hist.length && lastIssueIdx !== -1 && lastIssueIdx <= 3) {
    stabilityColor = lastIssueIdx === 0 ? '#EF5350' : '#FFD54F';
  }

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
      iconText={typeof config.icon === 'string' ? config.icon : null}
      tag={typeof config.tag === 'string' ? config.tag : null}
      editing={editing}
      onResize={onResize}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      onRename={onRename}
      onConfigure={onConfigure}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <StatusBadge status={status} />
            {stabilityText && (
              <p style={{ margin: '4px 0 0', fontSize: 10, color: stabilityColor, letterSpacing: 0.3 }}>
                {stabilityText}
              </p>
            )}
            {svc.details && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
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

      </div>
    </TileChrome>
  );
}
