import { getServices } from './services';
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
import { evaluateRulesForIncident, evaluateRulesForWebhook } from './alerts/rules';
import { sendWebhookAlerts } from './webhook';
import { metrics } from './metrics';
import { health, HealthSource } from './health';
import { circuit } from './fetchers/circuit';
import { fetchStatuspageStatus } from './fetchers/statuspage';
import { fetchMicrosoftStatus } from './fetchers/microsoft';
import { fetchSalesforceStatus } from './fetchers/salesforce';
import { fetchGoogleStatus } from './fetchers/google';
import { fetchWorkdayStatus } from './fetchers/workday';
import { fetchAwsStatus } from './fetchers/aws';
import { fetchDowndetectorStatus } from './fetchers/downdetector';

// Wrap a fetcher call with latency, success, and failure bookkeeping. Both
// underlying fetchers catch exceptions internally and return a result with
// `status: 'unknown'` plus a `details` message, so we treat "unknown" as a
// failure for health tracking purposes — it's the most reliable signal that
// the upstream didn't give us a useful answer.
//
// The circuit breaker layer short-circuits the call when an upstream has been
// failing repeatedly: instead of making the network request, it returns a
// fabricated "unknown" result via the supplied factory. This prevents the
// poller from hammering a broken upstream every 3 minutes while still
// generating one probe call per cooldown to detect recovery.
async function timedFetch<T>(
  serviceSlug: string,
  source: HealthSource,
  call: () => Promise<T>,
  inspect: (result: T) => { status: ServiceStatus; details: string | null },
  unknownFactory: (reason: string) => T,
): Promise<T> {
  if (circuit.shouldAttempt(serviceSlug, source) === 'block') {
    const until = circuit.openUntil(serviceSlug, source);
    const reason = until
      ? `circuit open until ${new Date(until).toISOString()}`
      : 'circuit open';
    metrics.recordFetcherFailure(serviceSlug, source, 'circuit_open');
    metrics.setCircuitState(serviceSlug, source, 'open');
    return unknownFactory(reason);
  }

  const start = Date.now();
  try {
    const result = await call();
    const latencyMs = Date.now() - start;
    metrics.recordFetcherLatency(serviceSlug, source, latencyMs / 1000);
    const { status, details } = inspect(result);
    if (status === 'unknown') {
      metrics.recordFetcherFailure(serviceSlug, source, 'unknown_status');
      health.recordFailure(serviceSlug, source, details ?? 'fetcher returned unknown', latencyMs);
      circuit.recordFailure(serviceSlug, source);
    } else {
      health.recordSuccess(serviceSlug, source, latencyMs);
      circuit.recordSuccess(serviceSlug, source);
    }
    metrics.setCircuitState(serviceSlug, source, circuit.getState(serviceSlug, source));
    return result;
  } catch (err) {
    const latencyMs = Date.now() - start;
    metrics.recordFetcherLatency(serviceSlug, source, latencyMs / 1000);
    metrics.recordFetcherFailure(serviceSlug, source, 'exception');
    health.recordFailure(serviceSlug, source, err, latencyMs);
    circuit.recordFailure(serviceSlug, source);
    metrics.setCircuitState(serviceSlug, source, circuit.getState(serviceSlug, source));
    throw err;
  }
}

function unknownFetchResult(serviceSlug: string, reason: string): FetchResult {
  return {
    status: {
      serviceSlug,
      source: 'official',
      status: 'unknown',
      details: reason,
      reportCount: null,
    },
    incidents: [],
  };
}

function unknownStatusResult(serviceSlug: string, reason: string): StatusResult {
  return {
    serviceSlug,
    source: 'downdetector',
    status: 'unknown',
    details: reason,
    reportCount: null,
  };
}

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

  // Fetch official status and Downdetector in parallel, with per-call latency
  // and health tracking. Each fetcher already swallows exceptions internally,
  // so timedFetch promotes "status: unknown" into a failure observation.
  const [officialResult, ddResult] = await Promise.allSettled([
    timedFetch<FetchResult>(
      service.slug,
      'official',
      () => fetchOfficialStatus(service),
      (r) => ({ status: r.status.status, details: r.status.details }),
      (reason) => unknownFetchResult(service.slug, reason),
    ),
    timedFetch<StatusResult>(
      service.slug,
      'downdetector',
      () => fetchDowndetectorStatus(service.downdetectorSlug, service.slug, {
        degraded: service.ddThresholdDegraded,
        major: service.ddThresholdMajor,
      }),
      (r) => ({ status: r.status, details: r.details }),
      (reason) => unknownStatusResult(service.slug, reason),
    ),
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
    metrics.setServiceStatus(service.slug, 'official', officialStatus.status);

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
        const webhookUrls = evaluateRulesForWebhook(incident);
        await Promise.all([
          sendIncidentAlert(incident, ruleRecipients),
          sendWebhookAlerts(incident, webhookUrls),
        ]);
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
    metrics.setServiceStatus(service.slug, 'downdetector', ddStatus.status);
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
    metrics.recordPollCycle('skipped', 0);
    return { success: false, polled: 0, errors: 0 };
  }

  isPolling = true;
  const cycleStart = Date.now();
  if (process.env.DEBUG === 'true') {
    console.log(`[poller] Starting poll cycle at ${new Date().toISOString()}`);
  }

  let polled = 0;
  let errors = 0;

  try {
    const results = await Promise.allSettled(
      getServices().map((service) => pollService(service))
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
    const durationSec = (Date.now() - cycleStart) / 1000;
    // "success" means at least one fetcher completed; "failure" only when
    // every service errored, which usually means the host lost outbound DNS.
    metrics.recordPollCycle(polled > 0 ? 'success' : 'failure', durationSec);
  }

  return { success: true, polled, errors };
}
