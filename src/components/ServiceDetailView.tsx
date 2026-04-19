'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useServiceStatus, useIncidents, useHistory } from '@/hooks/useStatus';
import { SERVICES } from '@/lib/services';
import { HistoryPoint } from '@/lib/types';
import StatTile from './ui/StatTile';
import Card from './ui/Card';
import StatusBadge from './StatusBadge';
import OutageChart from './OutageChart';

interface Props {
  slug: string;
}

function uptimeForService(points: HistoryPoint[]): number {
  if (!points.length) return 100;
  const totalMinutes = points.length * 24 * 60;
  const down = points.reduce((sum, p) => sum + (p.outageMinutes || 0), 0);
  return Math.max(0, ((totalMinutes - down) / totalMinutes) * 100);
}

function formatDateTime(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ServiceDetailView({ slug }: Props) {
  const config = SERVICES.find((s) => s.slug === slug);
  const { data: statusData } = useServiceStatus();
  const { data: incidentData } = useIncidents(30);
  const { data: historyData } = useHistory(30);

  const service = statusData?.services?.find((s) => s.slug === slug);
  const history = useMemo(
    () => historyData?.history?.[slug] || [],
    [historyData, slug],
  );
  const incidents = useMemo(
    () => (incidentData?.incidents || []).filter((i) => i.service === slug),
    [incidentData, slug],
  );

  const metrics = useMemo(() => {
    const uptime = uptimeForService(history);
    const outageDays = history.filter((p) => p.outageMinutes > 0).length;
    const totalDowntime = history.reduce((s, p) => s + p.outageMinutes, 0);
    const critical = incidents.filter((i) => i.severity === 'critical').length;
    return { uptime, outageDays, totalDowntime, critical };
  }, [history, incidents]);

  if (!config) {
    return (
      <Card className="text-center py-14">
        <p className="text-sm text-gray-400">Service not found.</p>
        <Link href="/" className="text-xs text-accent-cyan mt-3 inline-block">
          ← Back to overview
        </Link>
      </Card>
    );
  }

  const heroStatus = service?.overallStatus || 'unknown';
  const heroTint =
    heroStatus === 'operational'
      ? 'from-emerald-500/20 to-transparent'
      : heroStatus === 'degraded'
        ? 'from-yellow-500/20 to-transparent'
        : heroStatus === 'major_outage'
          ? 'from-orange-500/20 to-transparent'
          : heroStatus === 'down'
            ? 'from-red-500/20 to-transparent'
            : 'from-slate-500/20 to-transparent';

  return (
    <div className="space-y-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-foreground">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        All services
      </Link>

      <div className={`relative rounded-3xl surface-card p-8 overflow-hidden bg-gradient-to-br ${heroTint}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-xl"
              style={{ backgroundColor: config.color }}
            >
              {config.name.charAt(0)}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">
                {config.fetcher} · {config.slug}
              </p>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">{config.name}</h1>
              <div className="mt-3 flex items-center gap-3">
                <StatusBadge status={heroStatus} size="md" />
                {service?.details && (
                  <span className="text-xs text-gray-400 max-w-md truncate">{service.details}</span>
                )}
              </div>
            </div>
          </div>
          <a
            href={config.statusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-subtle text-xs text-foreground transition-colors"
          >
            Official status
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatTile
          label="30-Day Uptime"
          value={`${metrics.uptime.toFixed(2)}%`}
          accent={metrics.uptime >= 99.9 ? 'green' : metrics.uptime >= 99 ? 'amber' : 'red'}
          hint={metrics.uptime >= 99.9 ? 'Meeting SLA' : 'Below SLA'}
        />
        <StatTile
          label="Outage Days"
          value={metrics.outageDays}
          accent={metrics.outageDays > 0 ? 'amber' : 'green'}
          hint="of last 30"
        />
        <StatTile
          label="Total Downtime"
          value={metrics.totalDowntime > 60 ? `${(metrics.totalDowntime / 60).toFixed(1)}h` : `${metrics.totalDowntime}m`}
          accent="cyan"
          hint="30d cumulative"
        />
        <StatTile
          label="DD Reports"
          value={(service?.downdetectorReports || 0).toLocaleString()}
          accent="indigo"
          hint="live count"
        />
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">History</h2>
        <Card>
          <OutageChart
            serviceName={config.name}
            serviceColor={config.color}
            data={history}
          />
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Recent incidents</h2>
          <span className="text-xs text-gray-500">
            {incidents.length} in last 30 days · {metrics.critical} critical
          </span>
        </div>
        {incidents.length === 0 ? (
          <Card className="text-center py-10 text-sm text-gray-500">
            No incidents reported in the last 30 days.
          </Card>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <Card key={inc.id} className="flex items-start gap-4 flex-wrap">
                <span
                  className={`mt-1 w-2 h-2 rounded-full ${
                    inc.severity === 'critical'
                      ? 'bg-red-400'
                      : inc.severity === 'major'
                        ? 'bg-orange-400'
                        : 'bg-yellow-400'
                  } ${inc.status !== 'resolved' ? 'animate-pulse' : ''}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                        inc.severity === 'critical'
                          ? 'bg-red-500/10 text-red-400'
                          : inc.severity === 'major'
                            ? 'bg-orange-500/10 text-orange-400'
                            : 'bg-yellow-500/10 text-yellow-400'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span
                      className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                        inc.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-white/5 text-gray-400'
                      }`}
                    >
                      {inc.status}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {formatDateTime(inc.startedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground font-medium mt-1.5">{inc.title}</p>
                  {inc.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{inc.description}</p>
                  )}
                  {inc.sourceUrl && (
                    <a
                      href={inc.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent-cyan hover:underline mt-2 inline-block"
                    >
                      View source →
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
