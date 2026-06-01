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
  isServiceInMaintenance,
  getActiveUnresolvedIncidents,
  insertFetcherLatency,
} from './db';
import { sendIncidentAlert, sendStatusChangeAlert, sendEscalationAlert } from './email';
import { evaluateRulesForIncident, evaluateRulesForWebhook, evaluateRulesForEscalation, evaluateRulesForAnomaly } from './alerts/rules';
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
import { broadcastSSE } from './sse';
import { computeZScore } from './anomaly';
import { createLogger } from './logger';

const log = createLogger('poller');

// Wrap a fetcher call with latency, success, and failure bookkeeping.
async function timedFetch<T>(
  serviceSlug: string,
  source: HealthSource,
  call: () => Promise<T>,
  inspect: (result: T) => { status: ServiceStatus; details: string | null },
  unknownFactory: (reason: string) => T,
): Promise<{ result: T; latencyMs: number }> {
  if (circuit.shouldAttempt(serviceSlug, source) === 'block') {
    const until = circuit.openUntil(serviceSlug, source);
    const reason = until
      ? `circuit open until ${new Date(until).toISOString()}`
      : 'circuit open';
    metrics.recordFetcherFailure(serviceSlug, source, 'circuit_open');
    metrics.setCircuitState(serviceSlug, source, 'open');
    return { result: unknownFactory(reason), latencyMs: 0 };
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
    return { result, latencyMs };
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

const changedServices: string[] = [];

async function pollService(service: ServiceConfig): Promise<{ ddReports: number }> {
  if (process.env.DEBUG === 'true') {
    log.info(`Polling ${service.name}...`);
  }

  const previousStatus = getPreviousStatus(service.slug);
  const inMaintenance = isServiceInMaintenance(service.slug);

  const [officialSettled, ddSettled] = await Promise.allSettled([
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
  if (officialSettled.status === 'fulfilled') {
    const { result, latencyMs } = officialSettled.value;
    officialStatus = result.status;
    if (latencyMs > 0) insertFetcherLatency(service.slug, 'official', latencyMs);

    upsertServiceStatus(service.slug, 'official', officialStatus.status, officialStatus.details, officialStatus.reportCount);
    metrics.setServiceStatus(service.slug, 'official', officialStatus.status);

    if (previousStatus && previousStatus !== officialStatus.status) {
      changedServices.push(service.slug);
    }

    for (const incident of result.incidents) {
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

      if (isNew) {
        metrics.incIncidents(incident.serviceSlug, incident.severity);
      }

      // Send alerts only when not in a maintenance window
      if (isNew && (incident.severity === 'major' || incident.severity === 'critical') && !inMaintenance) {
        const ruleRecipients = evaluateRulesForIncident(incident);
        const webhooks = evaluateRulesForWebhook(incident);
        await Promise.all([
          sendIncidentAlert(incident, ruleRecipients),
          sendWebhookAlerts(incident, webhooks),
        ]);
      }
    }

    if (!inMaintenance && previousStatus && previousStatus !== officialStatus.status) {
      await sendStatusChangeAlert(service.slug, previousStatus, officialStatus.status);
    }
  } else {
    log.debug(`${service.name} official fetch rejected:`, officialSettled.reason);
  }

  // Process Downdetector
  let ddStatus: StatusResult | null = null;
  if (ddSettled.status === 'fulfilled') {
    const { result, latencyMs } = ddSettled.value;
    ddStatus = result;
    if (latencyMs > 0) insertFetcherLatency(service.slug, 'downdetector', latencyMs);

    // Anomaly detection (F9)
    const reportCount = ddStatus.reportCount ?? 0;
    const { isAnomaly, zScore } = computeZScore(service.slug, reportCount);

    upsertServiceStatus(service.slug, 'downdetector', ddStatus.status, ddStatus.details, ddStatus.reportCount, isAnomaly, zScore);
    metrics.setServiceStatus(service.slug, 'downdetector', ddStatus.status);

    if (isAnomaly && !inMaintenance) {
      const anomalyRecipients = evaluateRulesForAnomaly(service.slug);
      if (anomalyRecipients.length > 0) {
        await sendIncidentAlert(
          {
            serviceSlug: service.slug,
            incidentId: `anomaly_${service.slug}_${Date.now()}`,
            title: `Unusual spike in community reports (Z=${zScore.toFixed(1)})`,
            status: 'investigating',
            severity: 'minor',
            startedAt: new Date().toISOString(),
            resolvedAt: null,
            description: `Downdetector reports are significantly above normal (Z-score: ${zScore.toFixed(2)}). This may indicate an emerging issue.`,
            sourceUrl: null,
          },
          anomalyRecipients,
        );
      }
    }
  } else {
    log.debug(`${service.name} downdetector fetch rejected:`, ddSettled.reason);
  }

  const effectiveStatus = officialStatus?.status || ddStatus?.status || 'unknown';
  const reportCount = ddStatus?.reportCount || 0;
  insertStatusHistory(service.slug, effectiveStatus, reportCount, activeIncidentCount);

  log.debug(`${service.name}: ${effectiveStatus} (DD: ${reportCount} reports, active incidents: ${activeIncidentCount})`);

  return { ddReports: reportCount };
}

async function processEscalations() {
  try {
    const unresolved = getActiveUnresolvedIncidents(4);
    for (const incident of unresolved) {
      const recipients = evaluateRulesForEscalation(incident);
      for (const { email, level } of recipients) {
        await sendEscalationAlert(incident.service_slug, incident.incident_id, incident.title, level, [email]);
      }
    }
  } catch (err) {
    log.error('Escalation processing failed:', err);
  }
}

let isPolling = false;
let lastVacuumAt = 0;
const VACUUM_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function runPollCycle(): Promise<{ success: boolean; polled: number; errors: number }> {
  if (isPolling) {
    log.info('Poll cycle already in progress, skipping');
    metrics.recordPollCycle('skipped', 0);
    return { success: false, polled: 0, errors: 0 };
  }

  isPolling = true;
  changedServices.length = 0;
  const cycleStart = Date.now();
  if (process.env.DEBUG === 'true') {
    log.info(`Starting poll cycle at ${new Date().toISOString()}`);
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
        log.error('Service poll failed:', result.reason);
      }
    }

    if (ddFulfilled > 0 && totalDdReports === 0) {
      log.warn('DownDetector returned 0 reports for every service this cycle — scraper may be blocked or slugs may have drifted');
    }

    // Escalation alerts for long-running unresolved incidents
    await processEscalations();

    // Broadcast SSE event so connected clients refresh immediately (F1)
    broadcastSSE({ type: 'poll_complete', ts: Date.now(), services_changed: [...changedServices] });

    cleanupOldHistory(35);
    const prunedIncidents = cleanupOldIncidents(90);
    if (Date.now() - lastVacuumAt > VACUUM_INTERVAL_MS) {
      try {
        vacuumDb();
        lastVacuumAt = Date.now();
      } catch (err) {
        log.error('VACUUM failed:', err);
      }
    }
    if (process.env.DEBUG === 'true' || prunedIncidents > 0) {
      log.info(`Poll cycle complete: ${polled} succeeded, ${errors} failed, ${prunedIncidents} incidents pruned`);
    }
  } finally {
    isPolling = false;
    const durationSec = (Date.now() - cycleStart) / 1000;
    metrics.recordPollCycle(polled > 0 ? 'success' : 'failure', durationSec);
  }

  return { success: true, polled, errors };
}
