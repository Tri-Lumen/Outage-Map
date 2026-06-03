'use client';

import { useCallback, useEffect, useState } from 'react';
import { mutate } from 'swr';
import { formatRelativeTime } from '@/lib/format';

/**
 * Live "next refresh in Ns" pill plus a manual refresh button. Kept as its own
 * component so the 1-second countdown tick re-renders only this widget, not the
 * whole board. Manual refresh revalidates every status/incident/history/summary
 * SWR key at once.
 */
export default function RefreshControl({
  lastUpdated,
  refreshSec,
}: {
  lastUpdated?: string;
  refreshSec: number;
}) {
  const [remaining, setRemaining] = useState(refreshSec);
  const [spinning, setSpinning] = useState(false);

  // Reset the countdown when fresh data arrives or the interval changes.
  useEffect(() => { setRemaining(refreshSec); }, [lastUpdated, refreshSec]);

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => (r <= 1 ? refreshSec : r - 1)), 1000);
    return () => clearInterval(id);
  }, [refreshSec]);

  const doRefresh = useCallback(async () => {
    setSpinning(true);
    setRemaining(refreshSec);
    await mutate(
      (key) =>
        typeof key === 'string' &&
        (key.startsWith('/api/status') ||
          key.startsWith('/api/incidents') ||
          key.startsWith('/api/history') ||
          key.startsWith('/api/summary')),
      undefined,
      { revalidate: true },
    );
    setTimeout(() => setSpinning(false), 600);
  }, [refreshSec]);

  const fmtInterval = refreshSec < 60 ? `${refreshSec}s` : `${Math.round(refreshSec / 60)}m`;

  return (
    <div className="flex items-center gap-2">
      <div
        className="live-pill"
        title={lastUpdated ? `Updated ${formatRelativeTime(lastUpdated)}` : undefined}
      >
        <span className="live-dot" />
        <span>Next refresh · {remaining}s</span>
      </div>
      <button
        className="board-btn board-btn-icon"
        onClick={doRefresh}
        title={`Refresh now (auto every ${fmtInterval})`}
        aria-label="Refresh now"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={spinning ? 'animate-spin' : ''}
        >
          <path d="M23 4v6h-6M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </div>
  );
}
