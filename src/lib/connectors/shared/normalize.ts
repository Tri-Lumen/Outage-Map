import type { ServiceStatus } from '../../types';

// Single status-precedence table (the old microsoft.ts had its own; google/aws
// hand-rolled ad-hoc precedence). `unknown` ranks just above operational so a
// genuine degraded/outage signal always wins, but an unknown never masks a
// confirmed-operational reading from another source.
const STATUS_ORDER: Record<ServiceStatus, number> = {
  operational: 0,
  unknown: 1,
  degraded: 2,
  major_outage: 3,
  down: 4,
};

export function worseOf(a: ServiceStatus, b: ServiceStatus): ServiceStatus {
  return STATUS_ORDER[b] > STATUS_ORDER[a] ? b : a;
}

// Statuspage v2 `status.indicator` → our status. Unknown indicators map to
// `unknown` (honest) rather than guessing operational.
export function mapStatuspageIndicator(indicator: string): ServiceStatus {
  switch (indicator) {
    case 'none': return 'operational';
    case 'minor': return 'degraded';
    case 'major': return 'major_outage';
    case 'critical': return 'down';
    default: return 'unknown';
  }
}
