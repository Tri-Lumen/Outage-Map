'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteIncidents } from '@/hooks/useIncidentSearch';
import { useServiceStatus } from '@/hooks/useStatus';
import { getDependentServices } from '@/lib/serviceDependencies';
import type { IncidentResponse } from '@/lib/types';

const SEVERITY_STYLES: Record<string, { dot: string; border: string }> = {
  critical: { dot: 'bg-red-400', border: 'border-l-red-500' },
  major: { dot: 'bg-orange-400', border: 'border-l-orange-500' },
  minor: { dot: 'bg-yellow-400', border: 'border-l-yellow-500' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  investigating: { label: 'Investigating', color: 'text-red-400' },
  identified: { label: 'Identified', color: 'text-orange-400' },
  monitoring: { label: 'Monitoring', color: 'text-yellow-400' },
  resolved: { label: 'Resolved', color: 'text-green-400' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function IncidentRow({ incident, serviceNames }: { incident: IncidentResponse; serviceNames: Map<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  const severity = SEVERITY_STYLES[incident.severity] || SEVERITY_STYLES.minor;
  const statusInfo = STATUS_LABELS[incident.status] || STATUS_LABELS.investigating;
  const dependents = getDependentServices(incident.service);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      className={`px-5 py-3 border-l-2 ${severity.border} cursor-pointer hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors`}
      onClick={() => setExpanded((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((v) => !v); }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-1.5 h-1.5 rounded-full ${severity.dot} flex-shrink-0`} />
            <span className="text-xs font-medium text-muted">{incident.serviceName}</span>
            <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          <p className="text-sm text-foreground font-medium truncate">{incident.title}</p>
        </div>
        <span className="text-xs text-muted-strong flex-shrink-0">{formatDate(incident.startedAt)}</span>
      </div>
      {expanded && (
        <div className="mt-2 ml-3.5 space-y-2">
          {incident.description && (
            <p className="text-xs text-muted leading-relaxed">{incident.description}</p>
          )}
          {dependents.length > 0 && !incident.resolvedAt && (
            <p className="text-xs text-orange-400/90">
              ⚠ May cascade to {dependents.length} dependent service{dependents.length !== 1 ? 's' : ''}:{' '}
              {dependents.map((slug) => serviceNames.get(slug) ?? slug).join(', ')}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-strong">
            <span>Severity: <span className="text-foreground capitalize">{incident.severity}</span></span>
            {incident.resolvedAt && <span>Resolved: {formatDate(incident.resolvedAt)}</span>}
            {incident.sourceUrl && (
              <a
                href={incident.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-cyan hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                onClick={(e) => e.stopPropagation()}
              >
                View source
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IncidentFeed() {
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [severities, setSeverities] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRawQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(val), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const toggleSeverity = useCallback((s: string) => {
    setSeverities((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }, []);

  const { data: statusData } = useServiceStatus();
  const serviceNames = new Map((statusData?.services ?? []).map((s) => [s.slug, s.name]));

  const { incidents, loadMore, loading, hasMore } = useInfiniteIncidents({
    q: query || undefined,
    severity: severities.length ? severities : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 20,
  });

  // Load first page on mount / whenever filters change
  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, severities, dateFrom, dateTo]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore && !loading) loadMore(); },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  const hasActiveFilters = severities.length > 0 || dateFrom || dateTo;

  const exportCsv = useCallback(() => {
    const headers = ['ID', 'Service', 'Title', 'Severity', 'Status', 'Started', 'Resolved', 'Description'];
    const csvRows = incidents.map((inc) => [
      inc.id,
      inc.serviceName,
      `"${(inc.title || '').replace(/"/g, '""')}"`,
      inc.severity,
      inc.status,
      inc.startedAt ?? '',
      inc.resolvedAt ?? '',
      `"${(inc.description || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'incidents.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [incidents]);

  return (
    <div className="surface-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-subtle space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Recent Incidents</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={incidents.length === 0}
              title="Export the loaded incidents (respects active filters) as CSV"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-subtle text-muted hover:text-foreground hover:border-strong transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              CSV
            </button>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                hasActiveFilters || showFilters
                  ? 'border-accent/50 bg-accent/10 text-foreground'
                  : 'border-subtle text-muted hover:text-foreground hover:border-strong'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="search"
            value={rawQuery}
            onChange={handleQueryChange}
            placeholder="Search incidents…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-subtle text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent/50 transition-colors"
          />
          {rawQuery && (
            <button
              onClick={() => { setRawQuery(''); setQuery(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-foreground"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter drawer */}
        {showFilters && (
          <div className="space-y-3 pt-2 border-t border-subtle">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted mb-2">Severity</p>
              <div className="flex gap-2">
                {['critical', 'major', 'minor'].map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSeverity(s)}
                    className={`px-3 py-1 rounded-full text-xs capitalize border transition-colors ${
                      severities.includes(s)
                        ? 'border-accent bg-accent/10 text-foreground'
                        : 'border-subtle text-muted hover:border-strong'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2 py-1 rounded-md bg-white/5 border border-subtle text-xs text-foreground focus:outline-none focus:border-accent/50"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2 py-1 rounded-md bg-white/5 border border-subtle text-xs text-foreground focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => { setSeverities([]); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Incident list */}
      <div className="divide-y divide-[var(--border-subtle)] max-h-[520px] overflow-y-auto">
        {incidents.length === 0 && !loading ? (
          <div className="px-5 py-10 text-center text-muted">
            <svg className="w-10 h-10 mx-auto mb-3 text-muted-strong opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No incidents found</p>
          </div>
        ) : (
          incidents.map((incident) => <IncidentRow key={incident.id} incident={incident} serviceNames={serviceNames} />)
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {loading && (
          <div className="px-5 py-4 text-center">
            <div className="inline-flex items-center gap-2 text-xs text-muted">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          </div>
        )}

        {!hasMore && incidents.length > 0 && (
          <div className="px-5 py-3 text-center text-xs text-muted-strong">
            All {incidents.length} incidents loaded
          </div>
        )}
      </div>
    </div>
  );
}
