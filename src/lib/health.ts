// Per-fetcher health tracker. Today a single broken fetcher is hidden by the
// success of the other 13: /api/status looks fine because the cached row from
// before the break is still there. This module records the last success /
// failure / latency for each (service, source) so an operator can see at a
// glance which sources are stale, and so /api/health?probe=ready can fail
// loudly when a fetcher has been broken for too long.
import { getServices } from './services';

type Source = 'official' | 'downdetector';

interface FetcherHealth {
  service: string;
  source: Source;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  consecutiveFailures: number;
}

function key(service: string, source: Source): string {
  return `${service}:${source}`;
}

// Pin the state map to globalThis for the same reason metrics.ts does — the
// standalone Next build can otherwise hand each chunk its own empty Map.
const GLOBAL_KEY = Symbol.for('outage-map.fetcher-health');
type GlobalWithHealth = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, FetcherHealth>;
};

function state(): Map<string, FetcherHealth> {
  const g = globalThis as GlobalWithHealth;
  let m = g[GLOBAL_KEY];
  if (!m) {
    m = new Map();
    g[GLOBAL_KEY] = m;
  }
  return m;
}

function getOrInit(service: string, source: Source): FetcherHealth {
  const k = key(service, source);
  const map = state();
  let entry = map.get(k);
  if (!entry) {
    entry = {
      service,
      source,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      lastLatencyMs: null,
      consecutiveFailures: 0,
    };
    map.set(k, entry);
  }
  return entry;
}

function readyThreshold(): number {
  const raw = parseInt(process.env.READY_FAILURE_THRESHOLD || '5', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

function truncate(s: string, max: number = 240): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export const health = {
  recordSuccess(service: string, source: Source, latencyMs: number) {
    const entry = getOrInit(service, source);
    entry.lastSuccessAt = Date.now();
    entry.lastLatencyMs = latencyMs;
    entry.consecutiveFailures = 0;
  },
  recordFailure(service: string, source: Source, error: unknown, latencyMs: number | null = null) {
    const entry = getOrInit(service, source);
    entry.lastErrorAt = Date.now();
    entry.lastError = truncate(error instanceof Error ? error.message : String(error));
    if (latencyMs !== null) entry.lastLatencyMs = latencyMs;
    entry.consecutiveFailures += 1;
  },
  snapshot(): FetcherHealth[] {
    // Always include an entry per known service+source so the UI / scraper
    // can show "never run yet" instead of a missing row on a fresh boot.
    const out: FetcherHealth[] = [];
    for (const service of getServices()) {
      for (const source of ['official', 'downdetector'] as Source[]) {
        out.push(getOrInit(service.slug, source));
      }
    }
    return out;
  },
  isReady(): { ready: boolean; reason: string | null } {
    const threshold = readyThreshold();
    let failing: FetcherHealth | null = null;
    state().forEach((entry) => {
      if (!failing && entry.consecutiveFailures >= threshold) {
        failing = entry;
      }
    });
    if (failing) {
      const f = failing as FetcherHealth;
      return {
        ready: false,
        reason: `${f.service}:${f.source} has failed ${f.consecutiveFailures} consecutive cycles`,
      };
    }
    return { ready: true, reason: null };
  },
};

export type { FetcherHealth, Source as HealthSource };
