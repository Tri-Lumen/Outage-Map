import { z } from 'zod';
import type { IncidentResult, IncidentSeverity, IncidentStatus, ServiceStatus } from '../../types';
import type { Connector, ConnectorContext, ConnectorResult } from '../types';
import { unknownResult } from '../types';
import { fetchJson } from '../shared/fetchJson';
import { mapStatuspageIndicator } from '../shared/normalize';

// Lenient schemas — required fields are validated, everything else passes
// through. A mismatch is surfaced on the fetcher health surface (via fetchJson)
// instead of silently returning bad data.
const StatusSchema = z
  .object({ status: z.object({ indicator: z.string(), description: z.string().nullish() }) })
  .passthrough();

const IncidentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    impact: z.string(),
    created_at: z.string(),
    resolved_at: z.string().nullish(),
    shortlink: z.string().nullish(),
    incident_updates: z.array(z.object({ body: z.string().nullish() }).passthrough()).optional(),
  })
  .passthrough();

const IncidentsSchema = z.object({ incidents: z.array(IncidentSchema).default([]) }).passthrough();

type StatusJson = z.infer<typeof StatusSchema>;
type IncidentsJson = z.infer<typeof IncidentsSchema>;
type Incident = z.infer<typeof IncidentSchema>;

function mapImpactToSeverity(impact: string): IncidentSeverity {
  switch (impact) {
    case 'critical': return 'critical';
    case 'major': return 'major';
    default: return 'minor';
  }
}

function mapIncidentStatus(status: string): IncidentStatus {
  switch (status) {
    case 'identified': return 'identified';
    case 'monitoring': return 'monitoring';
    case 'resolved':
    case 'postmortem': return 'resolved';
    default: return 'investigating';
  }
}

/**
 * Authoritative-only status from the global indicator. The provider's
 * `status.indicator` is the page-level rollup, so it already reflects genuine
 * incidents. The one correction (the #18 Cloudflare bug): Statuspage rolls
 * scheduled maintenance and re-rated components into the indicator even when
 * nothing is actually disrupted, so a non-operational indicator with **no**
 * active unresolved incident (impact !== 'none') is dropped to operational.
 * If we couldn't fetch the unresolved set we trust the indicator as-is rather
 * than guess.
 */
export function deriveStatuspageStatus(
  indicator: string,
  description: string | null,
  unresolved: Incident[] | null,
): { status: ServiceStatus; details: string | null } {
  const base = mapStatuspageIndicator(indicator);
  if (base !== 'operational' && base !== 'unknown' && unresolved !== null) {
    const realActive = unresolved.filter((inc) => inc.impact !== 'none');
    if (realActive.length === 0) {
      return { status: 'operational', details: 'All systems operational' };
    }
  }
  return { status: base, details: description };
}

function mapIncidents(incidents: Incident[], serviceSlug: string): IncidentResult[] {
  return incidents.map((inc) => ({
    serviceSlug,
    incidentId: inc.id,
    title: inc.name,
    status: mapIncidentStatus(inc.status),
    severity: mapImpactToSeverity(inc.impact),
    startedAt: inc.created_at,
    resolvedAt: inc.resolved_at ?? null,
    description: inc.incident_updates?.[0]?.body ?? null,
    sourceUrl: inc.shortlink ?? null,
  }));
}

export function parseStatuspage(
  statusData: StatusJson | null,
  unresolvedData: IncidentsJson | null,
  incidentsData: IncidentsJson | null,
  serviceSlug: string,
): ConnectorResult {
  if (!statusData) return unknownResult('Unable to fetch status.json');

  const { status, details } = deriveStatuspageStatus(
    statusData.status.indicator,
    statusData.status.description ?? null,
    unresolvedData ? unresolvedData.incidents : null,
  );

  // incidents.json is newest-first; 25 covers the active window plus a healthy
  // chunk of recently-resolved history (display only — never drives status).
  const incidents = incidentsData ? mapIncidents(incidentsData.incidents.slice(0, 25), serviceSlug) : [];

  return { status: { status, details }, incidents };
}

export const statuspageConnector: Connector = {
  kind: 'statuspage',
  async fetch(ctx: ConnectorContext): Promise<ConnectorResult> {
    const base = ctx.statusUrl.replace(/\/+$/, '');
    const [statusR, unresolvedR, incidentsR] = await Promise.all([
      fetchJson(`${base}/api/v2/status.json`, StatusSchema, ctx.serviceSlug, { timeoutMs: 10000 }),
      fetchJson(`${base}/api/v2/incidents/unresolved.json`, IncidentsSchema, ctx.serviceSlug, { timeoutMs: 10000 }),
      fetchJson(`${base}/api/v2/incidents.json`, IncidentsSchema, ctx.serviceSlug, { timeoutMs: 10000 }),
    ]);

    return parseStatuspage(
      statusR.ok ? statusR.data : null,
      unresolvedR.ok ? unresolvedR.data : null,
      incidentsR.ok ? incidentsR.data : null,
      ctx.serviceSlug,
    );
  },
};
