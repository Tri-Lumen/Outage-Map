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

export function useServiceStatus(refreshIntervalMs?: number) {
  return useSWR<{ services: ServiceStatusResponse[]; lastUpdated: string }>(
    '/api/status',
    fetcher,
    {
      refreshInterval: refreshIntervalMs ?? 30000,
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

export function useHistory(days: number = 30, refreshIntervalMs?: number) {
  return useSWR<HistoryResponse>(
    `/api/history?days=${days}`,
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

export function useAlertLog(enabled: boolean, refreshIntervalMs?: number) {
  return useSWR<{ log: AlertLogEntry[] }>(
    enabled ? '/api/alerts/log' : null,
    fetcher,
    { refreshInterval: refreshIntervalMs ?? 60000, revalidateOnFocus: false }
  );
}

export type { FetcherHealthEntry, AlertLogEntry };
