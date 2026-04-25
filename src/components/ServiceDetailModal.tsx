'use client';

import { useEffect, useRef } from 'react';
import { ServiceStatusResponse, HistoryPoint, IncidentResponse } from '@/lib/types';
import StatusBadge from './StatusBadge';
import OutageChart from './OutageChart';

interface ServiceDetailModalProps {
  service: ServiceStatusResponse;
  history: HistoryPoint[];
  incidents: IncidentResponse[];
  onClose: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ServiceDetailModal({
  service,
  history,
  incidents,
  onClose,
}: ServiceDetailModalProps) {
  const serviceIncidents = incidents.filter((i) => i.service === service.slug);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousActive = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-detail-title"
        className="relative bg-surface border border-strong rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-subtle px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: service.color }}
            >
              {service.name.charAt(0)}
            </div>
            <div>
              <h2
                id="service-detail-title"
                className="text-lg font-semibold text-foreground tracking-tight"
                style={{ fontFamily: service.brandFont }}
              >
                {service.name}
              </h2>
              <StatusBadge status={service.overallStatus} size="sm" />
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close service details"
            className="text-muted hover:text-foreground transition-colors p-2 rounded-lg hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-elevated rounded-lg p-4 border border-subtle">
              <p className="text-xs text-muted mb-1">Official Status</p>
              <StatusBadge status={service.officialStatus} size="sm" />
              {service.details && (
                <p className="text-xs text-muted mt-2">{service.details}</p>
              )}
              <a
                href={service.statusUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-cyan hover:underline mt-2 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                View official source ↗
              </a>
            </div>
            <div className="bg-surface-elevated rounded-lg p-4 border border-subtle">
              <p className="text-xs text-muted mb-1">Downdetector</p>
              <StatusBadge status={service.downdetectorStatus} size="sm" />
              <p className="text-xs text-muted mt-2">
                {service.downdetectorStatus === 'unknown'
                  ? 'No data — open Downdetector directly'
                  : service.downdetectorReports > 0
                    ? `${service.downdetectorReports.toLocaleString()} reports`
                    : 'No reports'}
              </p>
              <a
                href={service.downdetectorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-cyan hover:underline mt-2 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                {service.downdetectorStatus === 'unknown' ? 'Open Downdetector' : 'View on Downdetector'} ↗
              </a>
            </div>
          </div>

          {/* 30-Day Chart */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">30-Day History</h3>
            <OutageChart
              serviceName={service.name}
              serviceColor={service.color}
              data={history}
            />
          </div>

          {/* Recent Incidents */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Recent Incidents ({serviceIncidents.length})
            </h3>
            {serviceIncidents.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">
                No recent incidents
              </p>
            ) : (
              <div className="space-y-2">
                {serviceIncidents.slice(0, 5).map((incident) => (
                  <div
                    key={incident.id}
                    className="bg-surface-elevated rounded-lg p-3 border border-subtle"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${
                        incident.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        incident.severity === 'major' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {incident.severity}
                      </span>
                      <span className="text-xs text-muted">
                        {formatDate(incident.startedAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{incident.title}</p>
                    {incident.description && (
                      <p className="text-xs text-muted mt-1 line-clamp-2">
                        {incident.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs capitalize ${
                        incident.status === 'resolved' ? 'text-green-400' :
                        incident.status === 'monitoring' ? 'text-yellow-400' :
                        'text-orange-400'
                      }`}>
                        {incident.status}
                      </span>
                      {incident.sourceUrl && (
                        <a
                          href={incident.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent-cyan hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                        >
                          View source
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
