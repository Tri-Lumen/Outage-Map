'use client';

import { useEffect, useRef, useState } from 'react';
import { useServiceStatus, useHistory, useIncidents } from '@/hooks/useStatus';
import type { HistoryPoint } from '@/lib/types';
import Sparkline from './Sparkline';

interface Props {
  primarySlug: string;
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function uptimeFor(points: HistoryPoint[]): number {
  if (!points.length) return 100;
  const total = points.length * 24 * 60;
  const down = points.reduce((s, p) => s + (p.outageMinutes || 0), 0);
  return Math.max(0, ((total - down) / total) * 100);
}

function mttrFor(points: HistoryPoint[]): number {
  const affected = points.filter((p) => p.outageMinutes > 0);
  if (!affected.length) return 0;
  return affected.reduce((s, p) => s + p.outageMinutes, 0) / affected.length;
}

function MetricBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function ServiceCompareModal({ primarySlug, onClose }: Props) {
  const [compareSlug, setCompareSlug] = useState<string>('');
  const { data: statusData } = useServiceStatus();
  const { data: historyData } = useHistory(30);
  const { data: incidentData } = useIncidents(30);
  const services = statusData?.services ?? [];
  const history = historyData?.history ?? {};
  const incidents = incidentData?.incidents ?? [];

  const primary = services.find((s) => s.slug === primarySlug);
  const compare = compareSlug ? services.find((s) => s.slug === compareSlug) : null;

  const primaryPoints = history[primarySlug] ?? [];
  const comparePoints = compareSlug ? (history[compareSlug] ?? []) : [];
  const primaryUptime = uptimeFor(primaryPoints);
  const compareUptime = compareSlug ? uptimeFor(comparePoints) : 0;
  const primaryMttr = mttrFor(primaryPoints);
  const compareMttr = compareSlug ? mttrFor(comparePoints) : 0;
  const primaryIncidents = incidents.filter((i) => i.service === primarySlug).length;
  const compareIncidents = compareSlug ? incidents.filter((i) => i.service === compareSlug).length : 0;
  const primaryTrend = primaryPoints.map((p) => Math.max(0, Math.min(1, (1440 - (p.outageMinutes || 0)) / 1440)));
  const compareTrend = comparePoints.map((p) => Math.max(0, Math.min(1, (1440 - (p.outageMinutes || 0)) / 1440)));

  const maxUptime = 100;
  const maxMttr = Math.max(primaryMttr, compareMttr, 1);
  const maxIncidents = Math.max(primaryIncidents, compareIncidents, 1);

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

  const otherServices = services.filter((s) => s.slug !== primarySlug);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-compare-title"
        className="relative w-full max-w-3xl surface-card rounded-2xl border border-subtle shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <h2 id="service-compare-title" className="text-lg font-semibold text-foreground">Service Comparison</h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Service picker */}
          <div>
            <label className="block text-xs text-muted mb-2">Compare with</label>
            <select
              value={compareSlug}
              onChange={(e) => setCompareSlug(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-subtle text-sm text-foreground focus:outline-none focus:border-accent/50"
            >
              <option value="">Select a service…</option>
              {otherServices.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Comparison grid */}
          <div className="grid grid-cols-2 gap-6">
            {[
              { svc: primary, uptime: primaryUptime, mttr: primaryMttr, incidents: primaryIncidents, trend: primaryTrend },
              { svc: compare, uptime: compareUptime, mttr: compareMttr, incidents: compareIncidents, trend: compareTrend },
            ].map((col, i) => (
              <div key={i} className="space-y-4">
                <div className="flex items-center gap-3">
                  {col.svc ? (
                    <>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: col.svc.color }}
                      >
                        {col.svc.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{col.svc.name}</p>
                        <p className="text-[10px] capitalize text-muted">{col.svc.overallStatus.replace('_', ' ')}</p>
                      </div>
                    </>
                  ) : (
                    <div className="h-8 flex items-center">
                      <p className="text-sm text-muted">{i === 0 ? 'Primary' : 'Select a service above'}</p>
                    </div>
                  )}
                </div>

                {col.svc && (
                  <>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted">30d Uptime</span>
                          <span className={col.uptime >= 99.9 ? 'text-emerald-400' : col.uptime >= 99 ? 'text-yellow-400' : 'text-red-400'}>
                            {col.uptime.toFixed(2)}%
                          </span>
                        </div>
                        <MetricBar value={col.uptime} max={maxUptime} color={col.svc.color} />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted">Avg MTTR</span>
                          <span className="text-foreground">{col.mttr > 0 ? `${Math.round(col.mttr)}m` : '—'}</span>
                        </div>
                        <MetricBar value={col.mttr} max={maxMttr} color="#FFB74D" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted">Incidents (30d)</span>
                          <span className="text-foreground">{col.incidents}</span>
                        </div>
                        <MetricBar value={col.incidents} max={maxIncidents} color="#EF5350" />
                      </div>
                    </div>
                    {col.trend.length >= 2 && (
                      <div>
                        <p className="text-xs text-muted mb-1">30d uptime trend</p>
                        <div className="h-10">
                          <Sparkline data={col.trend} color={col.svc.color} height={40} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {compare && primary && (
            <div className="pt-4 border-t border-subtle">
              <p className="text-xs text-muted">
                <span className="text-foreground font-medium">{primary.name}</span> is{' '}
                {primaryUptime > compareUptime ? (
                  <span className="text-emerald-400">{(primaryUptime - compareUptime).toFixed(2)}% more reliable</span>
                ) : primaryUptime < compareUptime ? (
                  <span className="text-red-400">{(compareUptime - primaryUptime).toFixed(2)}% less reliable</span>
                ) : (
                  <span>equally reliable</span>
                )}{' '}
                than <span className="text-foreground font-medium">{compare.name}</span> over the last 30 days.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
