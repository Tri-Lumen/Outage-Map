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

// Derive overall service status from a list of unresolved incidents.
// Incidents with impact 'none' are informational and don't affect service status.
function deriveStatusFromUnresolved(incidents: StatuspageIncident[]): ServiceStatus {
  let worst: ServiceStatus = 'operational';
  for (const inc of incidents) {
    if (inc.impact === 'none') continue;
    const sev = mapImpactToSeverity(inc.impact);
    if (sev === 'critical') return 'down';
    if (sev === 'major') { worst = 'major_outage'; }
    else if (worst === 'operational') { worst = 'degraded'; }
  }
  return worst;
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

  // Primary status source: unresolved incidents endpoint.
  // The status.json indicator includes scheduled maintenance windows which can
  // show 'minor' even when no real service disruption exists. Using unresolved
  // incidents as the source of truth avoids those false "degraded" reports.
  let statusDetermined = false;
  try {
    const unresolvedRes = await fetch(`${baseUrl}/api/v2/incidents/unresolved.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (unresolvedRes.ok) {
      const data: StatuspageIncidentsResponse = await unresolvedRes.json();
      statusResult.status = deriveStatusFromUnresolved(data.incidents);
      statusDetermined = true;
    }
  } catch (err) {
    console.error(`[statuspage] Failed to fetch unresolved incidents for ${serviceSlug}:`, err);
  }

  // Fallback: use status.json indicator if the unresolved endpoint failed.
  if (!statusDetermined) {
    try {
      const statusRes = await fetch(`${baseUrl}/api/v2/status.json`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (statusRes.ok) {
        const data: StatuspageStatus = await statusRes.json();
        statusResult.status = mapIndicatorToStatus(data.status.indicator);
        statusResult.details = data.status.description;
      }
    } catch (err) {
      console.error(`[statuspage] Failed to fetch status for ${serviceSlug}:`, err);
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
      const recentIncidents = data.incidents.slice(0, 10);

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
