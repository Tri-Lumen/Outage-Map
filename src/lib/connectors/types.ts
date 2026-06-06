import type { ServiceStatus, IncidentResult } from '../types';

// The set of connector implementations the registry knows about. This is the
// single selector that binds a catalog entry (ServiceConfig.kind) to a fetcher.
export type ConnectorKind = 'statuspage' | 'google' | 'microsoft' | 'salesforce' | 'aws';

// Canonical list + guard, kept here (no heavy imports) so the catalog can
// validate `kind` without importing the registry — which would pull in the
// connector impls and create a circular import through the health tracker.
export const CONNECTOR_KINDS: readonly ConnectorKind[] = [
  'statuspage', 'google', 'microsoft', 'salesforce', 'aws',
];

export function isConnectorKind(value: string): value is ConnectorKind {
  return (CONNECTOR_KINDS as readonly string[]).includes(value);
}

// Normalized status for a single provider. This is the old `StatusResult`
// stripped of the Downdetector-only `source` and `reportCount` fields — every
// value now comes from the provider's own ("official") feed.
export interface ConnectorStatus {
  status: ServiceStatus;
  details: string | null;
}

export interface ConnectorResult {
  status: ConnectorStatus;
  incidents: IncidentResult[];
}

// Everything a connector needs to do its work. Statuspage uses `statusUrl` as
// its API base; the other connectors hit fixed provider endpoints.
export interface ConnectorContext {
  serviceSlug: string;
  statusUrl: string;
}

export interface Connector {
  readonly kind: ConnectorKind;
  fetch(ctx: ConnectorContext): Promise<ConnectorResult>;
}

// Honest "could not determine" result. Connectors return this instead of
// fabricating an operational/degraded reading when a feed is unreachable or
// unparseable — the authoritative-only contract.
export function unknownResult(details: string): ConnectorResult {
  return { status: { status: 'unknown', details }, incidents: [] };
}

// Convenience for a confirmed-healthy provider with no active incidents.
export function operationalResult(details: string): ConnectorResult {
  return { status: { status: 'operational', details }, incidents: [] };
}
