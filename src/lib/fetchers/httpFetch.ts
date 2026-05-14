// Shared HTTP helper for every fetcher. Wraps `fetch` with:
//
// 1. A configurable timeout via AbortSignal.timeout (default FETCH_TIMEOUT_MS).
// 2. Retries on transient failures (network errors, 5xx, 429) with full-jitter
//    exponential backoff. Caller-side 4xx (other than 429) is not retried —
//    those are bugs in our request, not transient.
// 3. Honoring `Retry-After` on 429 when present.
//
// Each individual attempt uses its own AbortSignal so the timeout resets per
// retry. The total wall-clock for a call is therefore bounded by
// `(timeoutMs + maxBackoffMs) × (maxRetries + 1)`.

export interface HttpFetchOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number;
  maxRetries?: number;
  // Override the default 200ms base for the backoff curve.
  baseBackoffMs?: number;
}

const DEFAULT_BASE_BACKOFF_MS = 200;
const MAX_BACKOFF_MS = 8000;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function isTransientStatus(status: number): boolean {
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

function fullJitter(base: number, attempt: number): number {
  const exp = Math.min(base * 2 ** attempt, MAX_BACKOFF_MS);
  return Math.floor(Math.random() * exp);
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asInt = parseInt(header, 10);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt * 1000;
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function httpFetch(input: string, init: HttpFetchOptions = {}): Promise<Response> {
  const { timeoutMs, maxRetries, baseBackoffMs, ...rest } = init;
  const timeout = timeoutMs ?? envInt('FETCH_TIMEOUT_MS', 12000, 1000, 60000);
  const retries = maxRetries ?? envInt('FETCH_MAX_RETRIES', 2, 0, 5);
  const base = baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= retries) {
    try {
      const res = await fetch(input, {
        ...rest,
        signal: AbortSignal.timeout(timeout),
      });

      if (!isTransientStatus(res.status) || attempt === retries) {
        return res;
      }

      // Transient — drain the body to free the socket, then back off.
      try {
        await res.arrayBuffer();
      } catch {
        // ignore
      }

      const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
      const delay = retryAfter !== null ? Math.min(retryAfter, MAX_BACKOFF_MS) : fullJitter(base, attempt);
      await sleep(delay);
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
      const delay = fullJitter(base, attempt);
      await sleep(delay);
    }
    attempt += 1;
  }

  // Unreachable — the loop returns or throws — but TypeScript needs a value.
  throw lastError instanceof Error ? lastError : new Error('httpFetch exhausted retries');
}
