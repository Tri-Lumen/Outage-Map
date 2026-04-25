import { SERVICES } from './services';
import { ServiceConfig, FetchResult, StatusResult, ServiceStatus } from './types';
import {
  upsertServiceStatus,
  insertStatusHistory,
  upsertIncident,
  getServiceStatuses,
  cleanupOldHistory,
  cleanupOldIncidents,
  vacuumDb,
} from './db';
import { sendIncidentAlert, sendStatusChangeAlert } from './email';
import { evaluateRulesForIncident } from './alerts/rules';
import { fetchStatuspageStatus } from './fetchers/statuspage';
import { fetchMicrosoftStatus } from './fetchers/microsoft';
import { fetchSalesforceStatus } from './fetchers/salesforce';
import { fetchGoogleStatus } from './fetchers/google';
import { fetchWorkdayStatus } from './fetchers/workday';
import { fetchAwsStatus } from './fetchers/aws';
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
    case 'aws':
      return fetchAwsStatus(service.slug);
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

async function pollService(service: ServiceConfig): Promise<{ ddReports: number }> {
  if (process.env.DEBUG === 'true') {
    console.log(`[poller] Polling ${service.name}...`);
  }

  const previousStatus = getPreviousStatus(service.slug);

  // Fetch official status and Downdetector in parallel
  const [officialResult, ddResult] = await Promise.allSettled([
    fetchOfficialStatus(service),
    fetchDowndetectorStatus(service.downdetectorSlug, service.slug),
  ]);

  // Process official status
  let officialStatus: StatusResult | null = null;
  let activeIncidentCount = 0;
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
      if (!incident.resolvedAt) activeIncidentCount++;
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

      // Send alert for new major/critical incidents. Recipients come from the
      // alert_rules table; if no rule matches, fall back to ALERT_EMAILS so
      // env-only deployments keep working.
      if (isNew && (incident.severity === 'major' || incident.severity === 'critical')) {
        const ruleRecipients = evaluateRulesForIncident(incident);
        await sendIncidentAlert(incident, ruleRecipients);
      }
    }

    // Check for status change alerts
    if (previousStatus && previousStatus !== officialStatus.status) {
      await sendStatusChangeAlert(service.slug, previousStatus, officialStatus.status);
    }
  } else {
    console.debug(`[poller] ${service.name} official fetch rejected:`, officialResult.reason);
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
  } else {
    console.debug(`[poller] ${service.name} downdetector fetch rejected:`, ddResult.reason);
  }

  // Record history point — include active incident count so services whose
  // Statuspage reports issues still show a non-empty history even when DD
  // is disabled or returns zero reports.
  const effectiveStatus = officialStatus?.status || ddStatus?.status || 'unknown';
  const reportCount = ddStatus?.reportCount || 0;
  insertStatusHistory(service.slug, effectiveStatus, reportCount, activeIncidentCount);

  if (process.env.DEBUG === 'true') {
    console.log(
      `[poller] ${service.name}: ${effectiveStatus} (DD: ${reportCount} reports, active incidents: ${activeIncidentCount})`,
    );
  }

  return { ddReports: reportCount };
}

let isPolling = false;
let lastVacuumAt = 0;
const VACUUM_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function runPollCycle(): Promise<{ success: boolean; polled: number; errors: number }> {
  if (isPolling) {
    console.log('[poller] Poll cycle already in progress, skipping');
    return { success: false, polled: 0, errors: 0 };
  }

  isPolling = true;
  if (process.env.DEBUG === 'true') {
    console.log(`[poller] Starting poll cycle at ${new Date().toISOString()}`);
  }

  let polled = 0;
  let errors = 0;

  try {
    const results = await Promise.allSettled(
      SERVICES.map((service) => pollService(service))
    );

    let totalDdReports = 0;
    let ddFulfilled = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        polled++;
        totalDdReports += result.value.ddReports;
        ddFulfilled++;
      } else {
        errors++;
        console.error('[poller] Service poll failed:', result.reason);
      }
    }

    if (ddFulfilled > 0 && totalDdReports === 0) {
      console.warn(
        '[poller] DownDetector returned 0 reports for every service this cycle — scraper may be blocked or slugs may have drifted',
      );
    }

    // Cleanup old history + resolved incidents; VACUUM at most once per day.
    cleanupOldHistory(35);
    const prunedIncidents = cleanupOldIncidents(90);
    if (Date.now() - lastVacuumAt > VACUUM_INTERVAL_MS) {
      try {
        vacuumDb();
        lastVacuumAt = Date.now();
      } catch (err) {
        console.error('[poller] VACUUM failed:', err);
      }
    }
    if (process.env.DEBUG === 'true' || prunedIncidents > 0) {
      console.log(
        `[poller] Poll cycle complete: ${polled} succeeded, ${errors} failed, ${prunedIncidents} incidents pruned`,
      );
    }
  } finally {
    isPolling = false;
  }

  return { success: true, polled, errors };
}
