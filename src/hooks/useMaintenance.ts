'use client';

import useSWR from 'swr';
import type { MaintenanceWindow } from '@/lib/types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export function useMaintenance(refreshIntervalMs = 60000) {
  return useSWR<{ windows: MaintenanceWindow[] }>(
    '/api/maintenance',
    fetcher,
    { refreshInterval: refreshIntervalMs, revalidateOnFocus: true },
  );
}
