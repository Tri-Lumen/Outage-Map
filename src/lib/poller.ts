import { SERVICES } from './services';
import { ServiceConfig, FetchResult, StatusResult, ServiceStatus } from './types';
import {
  upsertServiceStatus,
  insertStatusHistory,
  upsertIncident,
  getServiceStatuses,
  cleanupOldHistory,
} from './db';
import { sendIncidentAlert, sendStatusChangeAlert } from './email';
import { fetchStatuspageStatus } from './fetchers/statuspage';
import { fetchMicrosoftStatus } from './fetchers/microsoft';
import { fetchSalesforceStatus } from './fetchers/salesforce';
import { fetchGoogleStatus } from './fetchers/google';
import { fetchWorkdayStatus } from './fetchers/workday';
import { fetchDowndetectorStatus } from './fetchers/downdetector';

async function fetchOfficialStatus(service: ServiceConfig): Promise<FetchResult> {
  switch (service.fetcher) {
    case 'statuspage':
      return fetchStatuspageStatus(service.statusUrl, service.slug);
    case 'microsoft':
      return fetchMicrosoftStatus(service.slug);
    case 'salesforce':
      return fetchSalesforceStatus(service.slug);
    case 'google':
      return fetchGoogleStatus(service.slug);
    case 'workday':
      return fetchWorkdayStatus(service.slug);
    default:
      return {
        status: {
          serviceSlug: service.slug,
          source: 'official',
          status: 'unknown',
          details: 'No fetcher configured',
          reportCount: null,
        },
        incidents: [],
      };
  }
}

function getPreviousStatus(serviceSlug: string): ServiceStatus | null {
  try {
    const statuses = getServiceStatuses();
    const official = statuses.find(
      (s) => s.service_slug === serviceSlug && s.source === 'official'
    );
    return (official?.status as ServiceStatus) || null;
  } catch {
    return null;
  }
}

async function pollService(service: ServiceConfig): Promise<void> {
  console.log(`[poller] Polling ${service.name}...`);

  const previousStatus = getPreviousStatus(service.slug);

  // Fetch official status and Downdetector in parallel
  const [officialResult, ddResult] = await Promise.allSettled([
    fetchOfficialStatus(service),
    fetchDowndetectorStatus(service.downdetectorSlug, service.slug),
  ]);

  // Process official status
  let officialStatus: StatusResult | null = null;
  if (officialResult.status === 'fulfilled') {
    officialStatus = officialResult.value.status;
    upsertServiceStatus(
      service.slug,
      'official',
      officialStatus.status,
      officialStatus.details,
      officialStatus.reportCount
    );

    // Process incidents
    for (const incident of officialResult.value.incidents) {
      const { isNew } = upsertIncident(
        incident.serviceSlug,
        incident.incidentId,
        incident.title,
        incident.status,
        incident.severity,
        incident.startedAt,
        incident.resolvedAt,
        incident.description,
        incident.sourceUrl
      );

      // Send alert for new major/critical incidents
      if (isNew && (incident.severity === 'major' || incident.severity === 'critical')) {
        await sendIncidentAlert(incident);
      }
    }

    // Check for status change alerts
    if (previousStatus && previousStatus !== officialStatus.status) {
      await sendStatusChangeAlert(service.slug, previousStatus, officialStatus.status);
    }
  }

  // Process Downdetector
  let ddStatus: StatusResult | null = null;
  if (ddResult.status === 'fulfilled') {
    ddStatus = ddResult.value;
    upsertServiceStatus(
      service.slug,
      'downdetector',
      ddStatus.status,
      ddStatus.details,
      ddStatus.reportCount
    );
  }

  // Record history point
  const effectiveStatus = officialStatus?.status || ddStatus?.status || 'unknown';
  const reportCount = ddStatus?.reportCount || 0;
  insertStatusHistory(service.slug, effectiveStatus, reportCount);

  console.log(`[poller] ${service.name}: ${effectiveStatus} (DD: ${reportCount} reports)`);
}

let isPolling = false;

export async function runPollCycle(): Promise<{ success: boolean; polled: number; errors: number }> {
  if (isPolling) {
    console.log('[poller] Poll cycle already in progress, skipping');
    return { success: false, polled: 0, errors: 0 };
  }

  isPolling = true;
  console.log(`[poller] Starting poll cycle at ${new Date().toISOString()}`);

  let polled = 0;
  let errors = 0;

  try {
    const results = await Promise.allSettled(
      SERVICES.map((service) => pollService(service))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        polled++;
      } else {
        errors++;
        console.error('[poller] Service poll failed:', result.reason);
      }
    }

    // Cleanup old history data
    cleanupOldHistory(35);

    console.log(`[poller] Poll cycle complete: ${polled} succeeded, ${errors} failed`);
  } finally {
    isPolling = false;
  }

  return { success: true, polled, errors };
}
