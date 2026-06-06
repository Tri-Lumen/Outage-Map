import { ServiceStatus } from './types';

/**
 * Authoritative-only overall status: the provider's official indicator IS the
 * source of truth. Active incidents are surfaced separately as a count/badge but
 * do not escalate operational → degraded — the global indicator already reflects
 * genuine global incidents. This is the structural fix for the false-positive
 * bugs (#17 Google zombie incidents, #18 Cloudflare maintenance-as-degraded):
 * with Downdetector and incident-escalation removed, a service tracks exactly
 * what its own status page reports.
 */
export function deriveOverallStatus(official: ServiceStatus): ServiceStatus {
  return official;
}
