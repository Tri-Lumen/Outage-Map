import { createHash } from 'crypto';

// The one stable incident-ID hasher, replacing four near-identical
// `crypto.createHash(...).slice(0,16)` copies across the old fetchers. Seed it
// with values that are stable across polls (provider id, begin time) — never
// `Date.now()`, which would mint a fresh ID every cycle and flood the DB.
export function stableIncidentId(
  prefix: string,
  ...parts: Array<string | number | null | undefined>
): string {
  const seed = parts.map((p) => String(p ?? '')).join('|');
  return `${prefix}-${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}
