'use client';

import { IncidentResponse } from '@/lib/types';
import { useState } from 'react';

interface IncidentFeedProps {
  incidents: IncidentResponse[];
}

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
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function IncidentFeed({ incidents }: IncidentFeedProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = incidents.filter((i) => {
    if (filter === 'active') return i.status !== 'resolved';
    if (filter === 'resolved') return i.status === 'resolved';
    return true;
  });

  return (
    <div className="surface-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-subtle flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Recent Incidents</h2>
        <div className="flex gap-1">
          {(['all', 'active', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                filter === f
                  ? 'bg-accent-soft text-foreground'
                  : 'text-muted hover:text-foreground hover:bg-surface-elevated'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-[var(--border-subtle)] max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted">
            <svg className="w-12 h-12 mx-auto mb-3 text-muted-strong" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No incidents to display</p>
          </div>
        ) : (
          filtered.map((incident) => {
            const severity = SEVERITY_STYLES[incident.severity] || SEVERITY_STYLES.minor;
            const statusInfo = STATUS_LABELS[incident.status] || STATUS_LABELS.investigating;
            const isExpanded = expandedId === incident.id;

            const toggle = () => setExpandedId(isExpanded ? null : incident.id);
            return (
              <div
                key={incident.id}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                className={`px-5 py-3 border-l-2 ${severity.border} cursor-pointer hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors`}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${severity.dot} flex-shrink-0`} />
                      <span className="text-xs font-medium text-muted">
                        {incident.serviceName}
                      </span>
                      <span className={`text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-sm text-foreground font-medium truncate">
                      {incident.title}
                    </p>
                  </div>
                  <span className="text-xs text-muted-strong flex-shrink-0">
                    {formatDate(incident.startedAt)}
                  </span>
                </div>

                {isExpanded && (
                  <div className="mt-2 ml-3.5 space-y-2">
                    {incident.description && (
                      <p className="text-xs text-muted leading-relaxed">
                        {incident.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-strong">
                      <span>Severity: <span className="text-foreground capitalize">{incident.severity}</span></span>
                      {incident.resolvedAt && (
                        <span>Resolved: {formatDate(incident.resolvedAt)}</span>
                      )}
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
          })
        )}
      </div>
    </div>
  );
}
