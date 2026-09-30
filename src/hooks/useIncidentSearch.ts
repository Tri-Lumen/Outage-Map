'use client';

import { useRef, useState, useCallback } from 'react';
import useSWR from 'swr';
import type { IncidentResponse } from '@/lib/types';

interface SearchOpts {
  q?: string;
  severity?: string[];
  dateFrom?: string;
  dateTo?: string;
  days?: number;
  service?: string;
  limit?: number;
  cursor?: string | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

function buildKey(opts: SearchOpts): string {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.severity?.length) opts.severity.forEach((s) => params.append('severity', s));
  if (opts.dateFrom) params.set('dateFrom', opts.dateFrom);
  if (opts.dateTo) params.set('dateTo', opts.dateTo);
  if (opts.days) params.set('days', String(opts.days));
  if (opts.service) params.set('service', opts.service);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.cursor) params.set('cursor', opts.cursor);
  const qs = params.toString();
  return `/api/incidents${qs ? `?${qs}` : ''}`;
}

export function useIncidentSearch(opts: SearchOpts) {
  return useSWR<{ incidents: IncidentResponse[]; total: number; nextCursor: string | null }>(
    buildKey(opts),
    fetcher,
    { revalidateOnFocus: false },
  );
}

// Infinite scroll accumulator: pages appended as the cursor advances.
export function useInfiniteIncidents(baseOpts: SearchOpts) {
  const [pages, setPages] = useState<IncidentResponse[][]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const resetKey = JSON.stringify({ ...baseOpts, cursor: null });
  const prevResetKey = useRef<string>(resetKey);

  if (prevResetKey.current !== resetKey) {
    prevResetKey.current = resetKey;
    setPages([]);
    setCursor(null);
    setHasMore(true);
  }

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const url = buildKey({ ...baseOpts, cursor });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { incidents: IncidentResponse[]; nextCursor: string | null } = await res.json();
      setPages((prev) => [...prev, data.incidents]);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch (err) {
      console.error('[useInfiniteIncidents]', err);
    } finally {
      setLoading(false);
    }
  }, [baseOpts, cursor, hasMore, loading]);

  const allIncidents = pages.flat();
  return { incidents: allIncidents, loadMore, loading, hasMore };
}
