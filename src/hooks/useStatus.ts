'use client';

import useSWR from 'swr';
import { ServiceStatusResponse, IncidentResponse, HistoryResponse, SummaryResponse } from '@/lib/types';

interface RssFeedResponse {
  feed: string;
  title: string;
  items: Array<{ title: string; url: string | null; publishedAt: string | null }>;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export function useServiceStatus(refreshIntervalMs?: number, opts?: { sse?: boolean }) {
  const sse = opts?.sse ?? false;
  return useSWR<{ services: ServiceStatusResponse[]; lastUpdated: string }>(
    '/api/status',
    fetcher,
    {
      // When SSE is active the push event triggers mutate(), so we can
      // poll less aggressively as a fallback only.
      refreshInterval: sse ? 120000 : (refreshIntervalMs ?? 30000),
      revalidateOnFocus: true,
      dedupingInterval: Math.min(10000, refreshIntervalMs ?? 10000),
    }
  );
}

export function useIncidents(days: number = 7, refreshIntervalMs?: number) {
  return useSWR<{ incidents: IncidentResponse[] }>(
    `/api/incidents?days=${days}`,
    fetcher,
    {
      refreshInterval: refreshIntervalMs ?? 60000,
      revalidateOnFocus: true,
    }
  );
}

export function useHistory(
  days: number = 30,
  refreshIntervalMs?: number,
  opts?: { from?: string; to?: string },
) {
  const params = new URLSearchParams({ days: String(days) });
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  return useSWR<HistoryResponse>(
    `/api/history?${params.toString()}`,
    fetcher,
    {
      refreshInterval: refreshIntervalMs ?? 300000,
      revalidateOnFocus: true,
    }
  );
}

export function useSummary(refreshIntervalMs?: number) {
  return useSWR<SummaryResponse>(
    '/api/summary',
    fetcher,
    {
      refreshInterval: refreshIntervalMs ?? 60000,
      revalidateOnFocus: true,
    }
  );
}

export function useRssFeed(feedId: string, customUrl?: string, refreshIntervalMs?: number) {
  const key = feedId === 'custom' && customUrl
    ? `/api/rss?feed=custom&url=${encodeURIComponent(customUrl)}`
    : feedId ? `/api/rss?feed=${encodeURIComponent(feedId)}` : null;
  return useSWR<RssFeedResponse>(key, fetcher, {
    refreshInterval: refreshIntervalMs ?? 300000,
    revalidateOnFocus: false,
  });
}

interface FetcherHealthEntry {
  service: string;
  source: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  consecutiveFailures: number;
  circuitState?: 'closed' | 'open' | 'half-open';
  openUntil?: number | null;
  lastParseError?: string | null;
  latency24h?: number[];
  errorRate24h?: number;
}

export function useFetcherHealth(refreshIntervalMs?: number) {
  return useSWR<{ fetchers: FetcherHealthEntry[] }>(
    '/api/health/fetchers',
    fetcher,
    {
      refreshInterval: refreshIntervalMs ?? 30000,
      revalidateOnFocus: true,
    }
  );
}

interface AlertLogEntry {
  id: number;
  service_slug: string;
  incident_id: string | null;
  alert_type: string;
  sent_at: string;
}

export function useAlertLog(enabled: boolean, limit: number = 50, refreshIntervalMs?: number) {
  return useSWR<{ log: AlertLogEntry[]; total: number; limit: number; offset: number }>(
    enabled ? `/api/alerts/log?limit=${limit}` : null,
    fetcher,
    { refreshInterval: refreshIntervalMs ?? 60000, revalidateOnFocus: false }
  );
}

export type { FetcherHealthEntry, AlertLogEntry };

export interface StatusTransition {
  id: number;
  serviceSlug: string;
  oldStatus: string;
  newStatus: string;
  duringMaintenance: boolean;
  occurredAt: string;
}

export function useTransitions(serviceSlug?: string, limit: number = 20, refreshIntervalMs?: number) {
  const params = new URLSearchParams();
  if (serviceSlug) params.set('service', serviceSlug);
  params.set('limit', String(limit));
  return useSWR<{ transitions: StatusTransition[] }>(
    `/api/transitions?${params.toString()}`,
    fetcher,
    { refreshInterval: refreshIntervalMs ?? 60000, revalidateOnFocus: false },
  );
}

export interface IncidentMetrics {
  days: number;
  mttrBySeverity: { critical?: number; major?: number; minor?: number };
  resolutionRate: number;
  totalIncidents: number;
  resolvedIncidents: number;
  countBySeverity: { critical?: number; major?: number; minor?: number };
  topServices: { service_slug: string; count: number }[];
}

export function useIncidentMetrics(days = 30, refreshIntervalMs = 60000) {
  return useSWR<IncidentMetrics>(
    `/api/incidents/metrics?days=${days}`,
    fetcher,
    { refreshInterval: refreshIntervalMs, revalidateOnFocus: false }
  );
}
