// Per-(service, source) circuit breaker. Stops the poller from hammering an
// upstream that has been failing repeatedly. State transitions:
//
//   closed  → open  : after FAILURE_THRESHOLD consecutive failures
//   open    → half-open : after a cooldown that doubles on each open→reopen
//   half-open → closed : on success of the probe call
//   half-open → open  : if the probe also fails (cooldown doubles, capped)
//
// "Failure" is anything that produces a StatusResult.status === 'unknown',
// matching the existing health-tracker semantics in src/lib/health.ts.

export type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitEntry {
  state: CircuitState;
  failures: number;
  openedAt: number | null;
  cooldownMs: number;
}

const FAILURE_THRESHOLD = parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD || '5', 10);
const BASE_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_COOLDOWN_MS = 80 * 60 * 1000;

const state = new Map<string, CircuitEntry>();

function key(service: string, source: string): string {
  return `${service}:${source}`;
}

function getOrInit(service: string, source: string): CircuitEntry {
  const k = key(service, source);
  let entry = state.get(k);
  if (!entry) {
    entry = { state: 'closed', failures: 0, openedAt: null, cooldownMs: BASE_COOLDOWN_MS };
    state.set(k, entry);
  }
  return entry;
}

export const circuit = {
  // Should the next call proceed? Returns 'allow' for closed / half-open,
  // 'block' when the circuit is open and the cooldown hasn't elapsed. Calling
  // this transitions open→half-open when the cooldown is up so the next call
  // becomes the probe.
  shouldAttempt(service: string, source: string): 'allow' | 'block' {
    const entry = getOrInit(service, source);
    if (entry.state === 'closed' || entry.state === 'half-open') return 'allow';
    if (entry.openedAt !== null && Date.now() - entry.openedAt >= entry.cooldownMs) {
      entry.state = 'half-open';
      return 'allow';
    }
    return 'block';
  },

  recordSuccess(service: string, source: string) {
    const entry = getOrInit(service, source);
    entry.state = 'closed';
    entry.failures = 0;
    entry.openedAt = null;
    entry.cooldownMs = BASE_COOLDOWN_MS;
  },

  recordFailure(service: string, source: string) {
    const entry = getOrInit(service, source);
    if (entry.state === 'half-open') {
      // Probe failed — re-open with a longer cooldown.
      entry.state = 'open';
      entry.failures += 1;
      entry.openedAt = Date.now();
      entry.cooldownMs = Math.min(entry.cooldownMs * 2, MAX_COOLDOWN_MS);
      return;
    }
    entry.failures += 1;
    if (entry.failures >= Math.max(FAILURE_THRESHOLD, 1)) {
      entry.state = 'open';
      entry.openedAt = Date.now();
      entry.cooldownMs = BASE_COOLDOWN_MS;
    }
  },

  getState(service: string, source: string): CircuitState {
    return getOrInit(service, source).state;
  },

  openUntil(service: string, source: string): number | null {
    const entry = getOrInit(service, source);
    if (entry.state !== 'open' || entry.openedAt === null) return null;
    return entry.openedAt + entry.cooldownMs;
  },
};
