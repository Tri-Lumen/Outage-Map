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

export function useRssFeed(feedId: string, refreshIntervalMs?: number) {
  return useSWR<RssFeedResponse>(
    feedId ? `/api/rss?feed=${encodeURIComponent(feedId)}` : null,
    fetcher,
    {
      refreshInterval: refreshIntervalMs ?? 300000,
      revalidateOnFocus: false,
    }
  );
}
