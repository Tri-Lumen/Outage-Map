'use client';

import { useMemo, useState } from 'react';
import { useServiceStatus, useIncidents, useHistory } from '@/hooks/useStatus';
import { SERVICES } from '@/lib/services';
import ServiceCard from './ServiceCard';
import IncidentFeed from './IncidentFeed';
import OutageChart from './OutageChart';
import ServiceDetailModal from './ServiceDetailModal';
import PageHeader from './ui/PageHeader';
import StatTile from './ui/StatTile';
import Card from './ui/Card';

type StatusFilter = 'all' | 'operational' | 'issues';

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return 'never';
  const date = new Date(ts);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString();
}

export default function Dashboard() {
  const { data: statusData, error: statusError, isLoading: statusLoading } = useServiceStatus();
  const { data: incidentData } = useIncidents(7);
  const { data: historyData } = useHistory(30);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const services = useMemo(() => statusData?.services || [], [statusData]);
  const incidents = useMemo(() => incidentData?.incidents || [], [incidentData]);
  const history = historyData?.history || {};

  const stats = useMemo(() => {
    const total = services.length || SERVICES.length;
    const operational = services.filter((s) => s.overallStatus === 'operational').length;
    const degraded = services.filter((s) => s.overallStatus === 'degraded').length;
    const outage = services.filter(
      (s) => s.overallStatus === 'major_outage' || s.overallStatus === 'down'
    ).length;
    const reports = services.reduce((sum, s) => sum + (s.downdetectorReports || 0), 0);
    const activeIncidents = incidents.filter((i) => i.status !== 'resolved').length;
    const uptime = total > 0 ? ((operational / total) * 100).toFixed(1) : '0.0';
    return { total, operational, degraded, outage, reports, activeIncidents, uptime };
  }, [services, incidents]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'operational' && s.overallStatus !== 'operational') return false;
      if (filter === 'issues' && s.overallStatus === 'operational') return false;
      return true;
    });
  }, [services, search, filter]);

  if (statusLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading dashboard…</p>
          <p className="text-gray-600 text-xs mt-1">Fetching service statuses</p>
        </div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="text-center max-w-md">
          <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">Unable to load dashboard</h2>
          <p className="text-gray-400 text-sm mb-4">
            Could not fetch service statuses. The polling service may not have run yet.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-accent hover:opacity-90 text-white text-sm rounded-lg transition-opacity"
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  const selected = services.find((s) => s.slug === selectedService);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Live Overview"
        title="Status command center"
        description={`Monitoring ${stats.total} enterprise services. Last updated ${formatTimestamp(statusData?.lastUpdated)}.`}
        actions={
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-300">Auto-refresh · 30s</span>
          </div>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatTile
          label="Overall Uptime"
          value={`${stats.uptime}%`}
          accent="green"
          hint={`${stats.operational}/${stats.total} services healthy`}
          icon={
            <svg className="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatTile
          label="Active Incidents"
          value={stats.activeIncidents}
          accent={stats.activeIncidents > 0 ? 'amber' : 'cyan'}
          hint={`${incidents.length} in last 7 days`}
          icon={
            <svg className="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatTile
          label="Degraded"
          value={stats.degraded + stats.outage}
          accent={stats.outage > 0 ? 'red' : stats.degraded > 0 ? 'amber' : 'cyan'}
          hint={`${stats.outage} major · ${stats.degraded} minor`}
          icon={
            <svg className="w-5 h-5 text-cyan-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          }
        />
        <StatTile
          label="DD Reports (now)"
          value={stats.reports.toLocaleString()}
          accent="indigo"
          hint="Aggregated across services"
          icon={
            <svg className="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          }
        />
      </section>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-accent-cyan" />
            Service Status
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services…"
                className="w-44 sm:w-56 pl-9 pr-3 py-1.5 rounded-md bg-white/5 border border-subtle text-sm text-foreground placeholder:text-gray-500 focus:outline-none focus:border-accent/50 focus:bg-white/10 transition-colors"
              />
            </div>
            <div className="flex bg-white/5 rounded-md p-0.5">
              {(['all', 'operational', 'issues'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    filter === f ? 'bg-accent-soft text-foreground' : 'text-gray-400 hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'operational' ? 'OK' : 'Issues'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {filteredServices.length === 0 ? (
          <Card className="text-center text-sm text-gray-500">
            No services match your filters.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.slug}
                service={service}
                onClick={() => setSelectedService(service.slug)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-purple-400" />
            30-Day Outage History
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {SERVICES.map((service) => (
              <OutageChart
                key={service.slug}
                serviceName={service.name}
                serviceColor={service.color}
                data={history[service.slug] || []}
              />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-orange-400" />
            Incident Feed
          </h2>
          <IncidentFeed incidents={incidents} />
        </div>
      </section>

      {selected && (
        <ServiceDetailModal
          service={selected}
          history={history[selected.slug] || []}
          incidents={incidents}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  );
}
