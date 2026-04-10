import { FetchResult, StatusResult, IncidentResult, ServiceStatus, IncidentSeverity } from '../types';

interface SalesforceIncident {
  id: string;
  message: {
    maintenanceId?: string;
    subject?: string;
    eventStatus?: string;
  };
  externalId?: string;
  IncidentEvents?: Array<{
    message: string;
    startTime: string;
    endTime: string;
    type: string;
  }>;
  IncidentImpacts?: Array<{
    severity: string;
    startTime: string;
    endTime: string | null;
  }>;
}

interface SalesforceIncidentsResponse {
  id?: string;
  key?: string;
  incidents?: SalesforceIncident[];
}

function mapSalesforceSeverity(severity: string): IncidentSeverity {
  const lower = severity?.toLowerCase() || '';
  if (lower.includes('critical') || lower.includes('major')) return 'critical';
  if (lower.includes('moderate') || lower.includes('degradation')) return 'major';
  return 'minor';
}

export async function fetchSalesforceStatus(serviceSlug: string): Promise<FetchResult> {
  const statusResult: StatusResult = {
    serviceSlug,
    source: 'official',
    status: 'unknown',
    details: null,
    reportCount: null,
  };
  const incidents: IncidentResult[] = [];

  try {
    // Fetch general status from the Salesforce Trust API
    const statusRes = await fetch('https://api.status.salesforce.com/v1/incidents/active', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OutageDashboard/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (statusRes.ok) {
      const activeIncidents: SalesforceIncident[] = await statusRes.json();

      if (!activeIncidents || activeIncidents.length === 0) {
        statusResult.status = 'operational';
        statusResult.details = 'All Salesforce services operational';
      } else {
        let worstStatus: ServiceStatus = 'degraded';

        for (const inc of activeIncidents) {
          const severity = inc.IncidentImpacts?.[0]?.severity || 'minor';
          const mappedSeverity = mapSalesforceSeverity(severity);

          if (mappedSeverity === 'critical') {
            worstStatus = 'major_outage';
          }

          incidents.push({
            serviceSlug,
            incidentId: inc.id || inc.externalId || `sf-${Date.now()}`,
            title: inc.message?.subject || 'Salesforce Incident',
            status: inc.message?.eventStatus === 'resolved' ? 'resolved' : 'investigating',
            severity: mappedSeverity,
            startedAt: inc.IncidentImpacts?.[0]?.startTime || new Date().toISOString(),
            resolvedAt: inc.IncidentImpacts?.[0]?.endTime || null,
            description: inc.IncidentEvents?.[0]?.message || null,
            sourceUrl: 'https://status.salesforce.com/',
          });
        }

        statusResult.status = worstStatus;
        statusResult.details = `${activeIncidents.length} active incident(s)`;
      }
    } else {
      throw new Error(`HTTP ${statusRes.status}`);
    }
  } catch (err) {
    console.error('[salesforce] Failed to fetch status:', err);

    // Fallback: try the main incidents endpoint
    try {
      const fallbackRes = await fetch('https://api.status.salesforce.com/v1/incidents?limit=5', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (fallbackRes.ok) {
        const data: SalesforceIncidentsResponse[] = await fallbackRes.json();
        const hasActive = Array.isArray(data) && data.some(
          (d) => d.incidents?.some((i) => i.message?.eventStatus !== 'resolved')
        );
        statusResult.status = hasActive ? 'degraded' : 'operational';
        statusResult.details = hasActive ? 'Some services may be affected' : 'All services operational';
      }
    } catch {
      statusResult.details = 'Unable to fetch Salesforce status';
    }
  }

  return { status: statusResult, incidents };
}
