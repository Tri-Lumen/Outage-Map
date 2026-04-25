import { FetchResult, StatusResult, IncidentResult, ServiceStatus, IncidentSeverity, IncidentStatus } from '../types';

interface StatuspageStatus {
  status: {
    indicator: 'none' | 'minor' | 'major' | 'critical';
    description: string;
  };
}

interface StatuspageIncident {
  id: string;
  name: string;
  status: string;
  impact: string;
  created_at: string;
  resolved_at: string | null;
  shortlink: string;
  incident_updates: Array<{
    body: string;
    status: string;
    updated_at: string;
  }>;
}

interface StatuspageIncidentsResponse {
  incidents: StatuspageIncident[];
}

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
    fetch(`${baseUrl}/api/v2/status.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    }),
    fetch(`${baseUrl}/api/v2/incidents/unresolved.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    }),
  ]);

  // Parse status.json
  if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
    try {
      const data: StatuspageStatus = await statusRes.value.json();
      statusResult.status = mapIndicatorToStatus(data.status.indicator);
      statusResult.details = data.status.description;
    } catch (err) {
      console.error(`[statuspage] Failed to parse status.json for ${serviceSlug}:`, err);
    }
  } else if (statusRes.status === 'rejected') {
    console.error(`[statuspage] Network error fetching status.json for ${serviceSlug}:`, statusRes.reason);
  } else {
    console.error(`[statuspage] HTTP ${statusRes.value.status} from status.json for ${serviceSlug} — check that ${baseUrl}/api/v2/status.json is reachable and returns valid Statuspage v2 JSON`);
  }

  // Apply maintenance-aware correction: if the indicator says degraded but there
  // are no active incidents, the elevation is from maintenance only — drop it.
  if (statusResult.status === 'degraded' && unresolvedRes.status === 'fulfilled' && unresolvedRes.value.ok) {
    try {
      const data: StatuspageIncidentsResponse = await unresolvedRes.value.json();
      const realIncidents = (data.incidents || []).filter((inc) => inc.impact !== 'none');
      if (realIncidents.length === 0) {
        statusResult.status = 'operational';
      }
    } catch {
      // Ignore parse errors — keep the indicator-derived status
    }
  }

  // Fetch all recent incidents for display (includes resolved).
  try {
    const incidentsRes = await fetch(`${baseUrl}/api/v2/incidents.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (incidentsRes.ok) {
      const data: StatuspageIncidentsResponse = await incidentsRes.json();
      // Statuspage's incidents.json returns the most recent first. 25 covers
      // the active-incident window plus a healthy chunk of recently-resolved
      // history without exploding the DB on busy services.
      const recentIncidents = (data.incidents || []).slice(0, 25);

      for (const inc of recentIncidents) {
        const latestUpdate = inc.incident_updates?.[0];
        incidents.push({
          serviceSlug,
          incidentId: inc.id,
          title: inc.name,
          status: mapIncidentStatus(inc.status),
          severity: mapImpactToSeverity(inc.impact),
          startedAt: inc.created_at,
          resolvedAt: inc.resolved_at,
          description: latestUpdate?.body || null,
          sourceUrl: inc.shortlink || null,
        });
      }
    }
  } catch (err) {
    console.error(`[statuspage] Failed to fetch incidents for ${serviceSlug}:`, err);
  }

  return { status: statusResult, incidents };
}
