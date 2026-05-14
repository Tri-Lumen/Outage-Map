import { NextResponse } from 'next/server';
import { health } from '@/lib/health';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Per-fetcher health snapshot. Returns one row per (service, source) with
// the timestamp of the last success / last error, the most recent error
// message, the most recent latency, and the running count of consecutive
// failures. Useful for the Sources view and for operators chasing down
// "why is one tile stale".
export function GET() {
  const snapshot = health.snapshot();
  return NextResponse.json({
    fetchers: snapshot.map((entry) => ({
      service: entry.service,
      source: entry.source,
      lastSuccessAt: entry.lastSuccessAt ? new Date(entry.lastSuccessAt).toISOString() : null,
      lastErrorAt: entry.lastErrorAt ? new Date(entry.lastErrorAt).toISOString() : null,
      lastError: entry.lastError,
      lastLatencyMs: entry.lastLatencyMs,
      consecutiveFailures: entry.consecutiveFailures,
    })),
  });
}
