import { FetchResult, StatusResult, IncidentResult, ServiceStatus, IncidentSeverity, IncidentStatus } from '../types';
import { httpFetch } from './httpFetch';
import { createLogger } from '../logger';
import { z } from 'zod';
import { health } from '../health';

const log = createLogger('statuspage');

// Lenient schemas: required fields are validated, everything else passes
// through. A schema mismatch means the upstream contract drifted — we record
// it on the fetcher health surface instead of silently returning bad data.
const StatusJsonSchema = z
  .object({
    status: z.object({
      indicator: z.string(),
      description: z.string().nullish(),
    }),
  })
  .passthrough();

const IncidentJsonSchema = z
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

const IncidentsJsonSchema = z
  .object({ incidents: z.array(IncidentJsonSchema).default([]) })
  .passthrough();

function mapIndicatorToStatus(indicator: string): ServiceStatus {
  switch (indicator) {
    case 'none': return 'operational';
    case 'minor': return 'degraded';
    case 'major': return 'major_outage';
    case 'critical': return 'down';
    default: return 'unknown';
  }
}

function mapImpactToSeverity(impact: string): IncidentSeverity {
  switch (impact) {
    case 'critical': return 'critical';
    case 'major': return 'major';
    default: return 'minor';
  }
}

function mapIncidentStatus(status: string): IncidentStatus {
  switch (status) {
    case 'investigating': return 'investigating';
    case 'identified': return 'identified';
    case 'monitoring': return 'monitoring';
    case 'resolved':
    case 'postmortem': return 'resolved';
    default: return 'investigating';
  }
}

export async function fetchStatuspageStatus(baseUrl: string, serviceSlug: string): Promise<FetchResult> {
  const statusResult: StatusResult = {
    serviceSlug,
    source: 'official',
    status: 'unknown',
    details: null,
    reportCount: null,
  };
  const incidents: IncidentResult[] = [];

  // Fetch status.json (overall indicator) and incidents/unresolved.json in parallel.
  // status.json is the primary source of truth; unresolved.json is used only to
  // correct a false "minor/degraded" reading caused by scheduled maintenance —
  // Statuspage rolls maintenance windows into the overall indicator even when no
  // actual service disruption exists. If unresolved incidents are empty while the
  // indicator says "minor", we downgrade to operational.
  const [statusRes, unresolvedRes] = await Promise.allSettled([
    httpFetch(`${baseUrl}/api/v2/status.json`, {
      headers: { 'Accept': 'application/json' },
      timeoutMs: 10000,
    }),
    httpFetch(`${baseUrl}/api/v2/incidents/unresolved.json`, {
      headers: { 'Accept': 'application/json' },
      timeoutMs: 10000,
    }),
  ]);

  // Parse status.json
  if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
    const json = await statusRes.value.json().catch(() => null);
    const parsed = StatusJsonSchema.safeParse(json);
    if (parsed.success) {
      statusResult.status = mapIndicatorToStatus(parsed.data.status.indicator);
      statusResult.details = parsed.data.status.description ?? null;
    } else {
      const msg = `status.json schema validation failed: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`;
      log.error(`${serviceSlug}: ${msg}`);
      health.recordParseError(serviceSlug, 'official', msg);
    }
  } else if (statusRes.status === 'rejected') {
    log.error(`Network error fetching status.json for ${serviceSlug}:`, statusRes.reason);
  } else {
    log.error(`HTTP ${statusRes.value.status} from status.json for ${serviceSlug} — check that ${baseUrl}/api/v2/status.json is reachable and returns valid Statuspage v2 JSON`);
  }

  // Apply maintenance-aware correction: if the indicator says degraded but there
  // are no active incidents, the elevation is from maintenance only — drop it.
  if (statusResult.status === 'degraded' && unresolvedRes.status === 'fulfilled' && unresolvedRes.value.ok) {
    const json = await unresolvedRes.value.json().catch(() => null);
    const parsed = IncidentsJsonSchema.safeParse(json);
    if (parsed.success) {
      const realIncidents = parsed.data.incidents.filter((inc) => inc.impact !== 'none');
      if (realIncidents.length === 0) {
        statusResult.status = 'operational';
      }
    }
  }

  // Fetch all recent incidents for display (includes resolved).
  try {
    const incidentsRes = await httpFetch(`${baseUrl}/api/v2/incidents.json`, {
      headers: { 'Accept': 'application/json' },
      timeoutMs: 10000,
    });

    if (incidentsRes.ok) {
      const json = await incidentsRes.json().catch(() => null);
      const parsed = IncidentsJsonSchema.safeParse(json);
      if (parsed.success) {
        // Statuspage's incidents.json returns the most recent first. 25 covers
        // the active-incident window plus a healthy chunk of recently-resolved
        // history without exploding the DB on busy services.
        const recentIncidents = parsed.data.incidents.slice(0, 25);

        for (const inc of recentIncidents) {
          const latestUpdate = inc.incident_updates?.[0];
          incidents.push({
            serviceSlug,
            incidentId: inc.id,
            title: inc.name,
            status: mapIncidentStatus(inc.status),
            severity: mapImpactToSeverity(inc.impact),
            startedAt: inc.created_at,
            resolvedAt: inc.resolved_at ?? null,
            description: latestUpdate?.body ?? null,
            sourceUrl: inc.shortlink ?? null,
          });
        }
      } else {
        const msg = `incidents.json schema validation failed: ${parsed.error.issues.map((i) => i.path.join('.')).join('; ')}`;
        log.error(`${serviceSlug}: ${msg}`);
        health.recordParseError(serviceSlug, 'official', msg);
      }
    }
  } catch (err) {
    log.error(`Failed to fetch incidents for ${serviceSlug}:`, err);
  }

  return { status: statusResult, incidents };
}
