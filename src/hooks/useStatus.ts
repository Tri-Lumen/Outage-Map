'use client';

import useSWR from 'swr';
import { ServiceStatusResponse, IncidentResponse, HistoryResponse } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useServiceStatus() {
  return useSWR<{ services: ServiceStatusResponse[]; lastUpdated: string }>(
    '/api/status',
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );
}

export function useIncidents(days: number = 7) {
  return useSWR<{ incidents: IncidentResponse[] }>(
    `/api/incidents?days=${days}`,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
    }
  );
}

export function useHistory(days: number = 30) {
  return useSWR<HistoryResponse>(
    `/api/history?days=${days}`,
    fetcher,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: true,
    }
  );
}
