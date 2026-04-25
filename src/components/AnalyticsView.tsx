'use client';

import { useMemo } from 'react';
import { useServiceStatus, useHistory, useIncidents } from '@/hooks/useStatus';
import { SERVICES } from '@/lib/services';
import { HistoryPoint } from '@/lib/types';
import PageHeader from './ui/PageHeader';
import StatTile from './ui/StatTile';
import Card from './ui/Card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

function uptimeForService(points: HistoryPoint[]): number {
  if (!points.length) return 100;
  const totalMinutes = points.length * 24 * 60;
  const downMinutes = points.reduce((sum, p) => sum + (p.outageMinutes || 0), 0);
  return Math.max(0, ((totalMinutes - downMinutes) / totalMinutes) * 100);
}

function mttrForService(points: HistoryPoint[]): number {
  const affected = points.filter((p) => p.outageMinutes > 0);
  if (!affected.length) return 0;
  return affected.reduce((s, p) => s + p.outageMinutes, 0) / affected.length;
}

export default function AnalyticsView() {
  const { data: statusData } = useServiceStatus();
  const { data: historyData } = useHistory(30);
  const { data: incidentData } = useIncidents(30);

  const services = useMemo(() => statusData?.services || [], [statusData]);
  const history = useMemo(() => historyData?.history || {}, [historyData]);
  const incidents = useMemo(() => incidentData?.incidents || [], [incidentData]);

  const rows = useMemo(() => {
    return SERVICES.map((s) => {
      const points = history[s.slug] || [];
      const uptime = uptimeForService(points);
      const mttr = mttrForService(points);
      const live = services.find((x) => x.slug === s.slug);
      const serviceIncidents = incidents.filter((i) => i.service === s.slug);
      return {
        slug: s.slug,
        name: s.name,
        color: s.color,
        uptime,
        uptimeLabel: uptime.toFixed(2),
        mttr: Math.round(mttr),
        outageDays: points.filter((p) => p.outageMinutes > 0).length,
        totalDowntime: points.reduce((sum, p) => sum + p.outageMinutes, 0),
        incidents: serviceIncidents.length,
        criticalIncidents: serviceIncidents.filter((i) => i.severity === 'critical').length,
        status: live?.overallStatus || 'unknown',
      };
    });
  }, [history, incidents, services]);

  const aggregate = useMemo(() => {
    const avgUptime =
      rows.reduce((s, r) => s + r.uptime, 0) / Math.max(rows.length, 1);
    const totalDowntime = rows.reduce((s, r) => s + r.totalDowntime, 0);
    const totalIncidents = rows.reduce((s, r) => s + r.incidents, 0);
    const slaTarget = 99.9;
    const meetingSla = rows.filter((r) => r.uptime >= slaTarget).length;
    return { avgUptime, totalDowntime, totalIncidents, slaTarget, meetingSla };
  }, [rows]);

  const uptimeChartData = rows.map((r) => ({
    name: r.name.split(' ')[0],
    uptime: Number(r.uptime.toFixed(2)),
    color: r.color,
  }));

  const yMin = rows.length
    ? Math.max(0, Math.floor(Math.min(...rows.map((r) => r.uptime)) - 0.5))
    : 98;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="30-Day Analytics"
        title="Reliability & SLA trends"
        description="Uptime, downtime minutes, and incident distribution across monitored services."
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatTile
          label="Avg. Uptime"
          value={`${aggregate.avgUptime.toFixed(2)}%`}
          accent="green"
          hint="Across all services"
          trend={aggregate.avgUptime >= 99.9 ? 'up' : 'down'}
          trendLabel={aggregate.avgUptime >= 99.9 ? 'Above SLA' : 'Below 99.9%'}
        />
        <StatTile
          label="SLA Compliance"
          value={`${aggregate.meetingSla}/${rows.length}`}
          accent="cyan"
          hint={`Services meeting ${aggregate.slaTarget}%`}
        />
        <StatTile
          label="Total Downtime"
          value={`${Math.round(aggregate.totalDowntime / 60)}h`}
          accent="amber"
          hint={`${aggregate.totalDowntime.toLocaleString()} min · last 30d`}
        />
        <StatTile
          label="Incidents (30d)"
          value={aggregate.totalIncidents}
          accent={aggregate.totalIncidents > 10 ? 'red' : 'indigo'}
          hint="All severities"
        />
      </section>

      <section>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Uptime by service</h2>
              <p className="text-xs text-gray-400 mt-0.5">30-day rolling window</p>
            </div>
            <span className="text-xs text-muted">SLA target: {aggregate.slaTarget}%</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={uptimeChartData} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--border-strong)' }}
                tickLine={false}
              />
              <YAxis
                domain={[yMin, 100]}
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--border-strong)' }}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--foreground)',
                }}
                formatter={(val) => [`${val}%`, 'Uptime']}
              />
              <Bar dataKey="uptime" radius={[6, 6, 0, 0]}>
                {uptimeChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-accent-cyan" />
          Service reliability breakdown
        </h2>
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] border-b border-subtle">
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium text-right">Uptime</th>
                  <th className="px-5 py-3 font-medium text-right">Downtime</th>
                  <th className="px-5 py-3 font-medium text-right">MTTR</th>
                  <th className="px-5 py-3 font-medium text-right">Incidents</th>
                  <th className="px-5 py-3 font-medium text-right">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((r) => {
                  const meets = r.uptime >= aggregate.slaTarget;
                  return (
                    <tr key={r.slug} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: r.color }}
                          />
                          <span className="text-foreground font-medium">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <span
                          className={
                            r.uptime >= 99.9
                              ? 'text-emerald-400'
                              : r.uptime >= 99
                                ? 'text-yellow-400'
                                : 'text-red-400'
                          }
                        >
                          {r.uptimeLabel}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300 tabular-nums">
                        {r.totalDowntime > 60
                          ? `${(r.totalDowntime / 60).toFixed(1)}h`
                          : `${r.totalDowntime}m`}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300 tabular-nums">
                        {r.mttr > 0 ? `${r.mttr}m` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-gray-300 tabular-nums">{r.incidents}</span>
                        {r.criticalIncidents > 0 && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                            {r.criticalIncidents} critical
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            meets
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {meets ? '✓ meets' : '✗ breach'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
