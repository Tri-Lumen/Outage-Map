'use client';

import { useServiceStatus } from '@/hooks/useStatus';
import { getStatusColor } from '@/lib/boardColors';
import { useStatusPalette } from '@/hooks/useStatusPalette';
import { formatRelativeTime } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';

export default function PublicStatusPage() {
  useStatusPalette();
  const { data, isLoading } = useServiceStatus(60000);
  const services = data?.services ?? [];

  const down = services.filter((s) => s.overallStatus === 'down' || s.overallStatus === 'major_outage').length;
  const degraded = services.filter((s) => s.overallStatus === 'degraded').length;
  const overall = down > 0 ? 'down' : degraded > 0 ? 'degraded' : 'operational';
  const c = getStatusColor(overall);

  const headline =
    services.length === 0
      ? 'Status unavailable'
      : overall === 'operational'
        ? 'All systems operational'
        : down > 0
          ? `${down} service${down !== 1 ? 's' : ''} experiencing an outage`
          : `${degraded} service${degraded !== 1 ? 's' : ''} degraded`;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">System Status</h1>
          <span className="text-xs text-muted">
            {data?.lastUpdated ? `Updated ${formatRelativeTime(data.lastUpdated)}` : ''}
          </span>
        </div>

        <div
          className="rounded-2xl border p-5 mb-6 flex items-center gap-3"
          style={{ background: c.bg, borderColor: c.dot }}
        >
          <span className="w-3 h-3 rounded-full" style={{ background: c.dot }} />
          <span className="text-base font-medium" style={{ color: c.text }}>
            {isLoading && services.length === 0 ? 'Loading…' : headline}
          </span>
        </div>

        <div className="rounded-2xl border border-subtle overflow-hidden surface-card">
          {services.map((s, i) => (
            <div
              key={s.slug}
              className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-subtle' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: s.color }}
                >
                  {s.name.substring(0, 2).toUpperCase()}
                </span>
                <span className="text-sm text-foreground truncate" style={{ fontFamily: s.brandFont }}>
                  {s.name}
                </span>
              </div>
              <StatusBadge status={s.overallStatus} size="sm" />
            </div>
          ))}
          {!isLoading && services.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted">No services to display.</div>
          )}
        </div>

        <p className="text-[11px] text-muted text-center mt-6">
          Embed this status anywhere with{' '}
          <code className="text-muted-strong">&lt;iframe src=&quot;/embed&quot;&gt;</code>
        </p>
      </div>
    </div>
  );
}
