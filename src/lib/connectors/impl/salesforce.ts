import { z } from 'zod';
import type { IncidentResult, IncidentSeverity, ServiceStatus } from '../../types';
import type { Connector, ConnectorContext, ConnectorResult } from '../types';
import { unknownResult, operationalResult } from '../types';
import { fetchJson } from '../shared/fetchJson';
import { stableIncidentId } from '../shared/incidentId';

const ACTIVE_URL = 'https://api.status.salesforce.com/v1/incidents/active';

const ImpactSchema = z
  .object({ severity: z.string().nullish(), startTime: z.string().nullish(), endTime: z.string().nullish() })
  .passthrough();

const IncidentSchema = z
  .object({
    // Salesforce's live API sends this as a number despite looking like an
    // opaque id elsewhere — coerce to string rather than reject.
    id: z.union([z.string(), z.number()]).nullish().transform((v) => (v == null ? v : String(v))),
    externalId: z.string().nullish(),
    message: z.object({ subject: z.string().nullish(), eventStatus: z.string().nullish() }).nullish(),
    IncidentImpacts: z.array(ImpactSchema).nullish(),
    IncidentEvents: z.array(z.object({ message: z.string().nullish() }).passthrough()).nullish(),
  })
  .passthrough();

const ActiveSchema = z.array(IncidentSchema);
type SalesforceIncident = z.infer<typeof IncidentSchema>;

function mapSeverity(severity: string): IncidentSeverity {
  const lower = severity.toLowerCase();
  if (lower.includes('critical') || lower.includes('major')) return 'critical';
  if (lower.includes('moderate') || lower.includes('degradation')) return 'major';
  return 'minor';
}

// The /incidents/active endpoint returns exactly the active set, so its
// non-emptiness is authoritative — no maintenance-leak correction needed.
export function parseSalesforceActive(active: SalesforceIncident[], serviceSlug: string): ConnectorResult {
  if (active.length === 0) return operationalResult('All Salesforce services operational');

  let worst: ServiceStatus = 'degraded';
  const incidents: IncidentResult[] = [];

  for (const inc of active) {
    const impact = inc.IncidentImpacts?.[0];
    const severity = mapSeverity(impact?.severity || 'minor');
    if (severity === 'critical') worst = 'major_outage';

    const startedAt = impact?.startTime ?? null;
    const publicId = inc.externalId || inc.id || null;
    const sourceUrl = publicId
      ? `https://status.salesforce.com/incidents/${encodeURIComponent(publicId)}`
      : 'https://status.salesforce.com/';

    incidents.push({
      serviceSlug,
      // Use a real, stable id — never `Date.now()`, which minted a new id per poll.
      incidentId: inc.id || inc.externalId || stableIncidentId('sf', inc.message?.subject, startedAt),
      title: inc.message?.subject || 'Salesforce Incident',
      status: inc.message?.eventStatus === 'resolved' ? 'resolved' : 'investigating',
      severity,
      startedAt,
      resolvedAt: impact?.endTime ?? null,
      description: inc.IncidentEvents?.[0]?.message ?? null,
      sourceUrl,
    });
  }

  return { status: { status: worst, details: `${active.length} active incident(s)` }, incidents };
}

export const salesforceConnector: Connector = {
  kind: 'salesforce',
  async fetch(ctx: ConnectorContext): Promise<ConnectorResult> {
    const r = await fetchJson(ACTIVE_URL, ActiveSchema, ctx.serviceSlug, {
      timeoutMs: 10000,
      headers: { Accept: 'application/json', 'User-Agent': 'OutageDashboard/1.0' },
    });
    if (!r.ok) return unknownResult('Unable to fetch Salesforce status');
    return parseSalesforceActive(r.data, ctx.serviceSlug);
  },
};
