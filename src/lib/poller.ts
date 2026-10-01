import { randomUUID } from 'crypto';
import { getServices } from './services';
import { ServiceConfig, ServiceStatus } from './types';
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
import { evaluateRulesForIncident, evaluateRulesForWebhook, evaluateRulesForEscalation } from './alerts/rules';
import { sendWebhookAlerts } from './webhook';
import { metrics } from './metrics';
import { health } from './health';
import { circuit } from './fetchers/circuit';
import { runConnector } from './connectors/registry';
import { ConnectorResult, unknownResult } from './connectors/types';
import { broadcastSSE } from './sse';
import { createLogger } from './logger';

const log = createLogger('poller');

// Wrap the connector call with latency, success, and failure bookkeeping. There
// is now a single source per service ('official'); the circuit breaker and
// health tracker are keyed on it.
async function timedFetch(
  serviceSlug: string,
  call: () => Promise<ConnectorResult>,
): Promise<{ result: ConnectorResult; latencyMs: number }> {
  if (circuit.shouldAttempt(serviceSlug, 'official') === 'block') {
    const until = circuit.openUntil(serviceSlug, 'official');
    const reason = until ? `circuit open until ${new Date(until).toISOString()}` : 'circuit open';
    metrics.recordFetcherFailure(serviceSlug, 'official', 'circuit_open');
    metrics.setCircuitState(serviceSlug, 'official', 'open');
    return { result: unknownResult(reason), latencyMs: 0 };
  }

  const start = Date.now();
  try {
    const result = await call();
    const latencyMs = Date.now() - start;
    metrics.recordFetcherLatency(serviceSlug, 'official', latencyMs / 1000);
    if (result.status.status === 'unknown') {
      metrics.recordFetcherFailure(serviceSlug, 'official', 'unknown_status');
      health.recordFailure(serviceSlug, 'official', result.status.details ?? 'connector returned unknown', latencyMs);
      circuit.recordFailure(serviceSlug, 'official');
    } else {
      health.recordSuccess(serviceSlug, 'official', latencyMs);
      circuit.recordSuccess(serviceSlug, 'official');
    }
    metrics.setCircuitState(serviceSlug, 'official', circuit.getState(serviceSlug, 'official'));
    return { result, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    metrics.recordFetcherLatency(serviceSlug, 'official', latencyMs / 1000);
    metrics.recordFetcherFailure(serviceSlug, 'official', 'exception');
    health.recordFailure(serviceSlug, 'official', err, latencyMs);
    circuit.recordFailure(serviceSlug, 'official');
    metrics.setCircuitState(serviceSlug, 'official', circuit.getState(serviceSlug, 'official'));
    throw err;
  }
}

function getPreviousStatus(serviceSlug: string): ServiceStatus | null {
  try {
    const official = getServiceStatuses().find(
      (s) => s.service_slug === serviceSlug && s.source === 'official',
    );
    return (official?.status as ServiceStatus) || null;
  } catch {
    return null;
  }
}

const changedServices: string[] = [];

async function pollService(service: ServiceConfig, cycleId: string): Promise<void> {
  if (process.env.DEBUG === 'true') {
    log.info(`[cycle ${cycleId}] Polling ${service.name}...`);
  }

  const previousStatus = getPreviousStatus(service.slug);
  const inMaintenance = isServiceInMaintenance(service.slug);

  const { result, latencyMs } = await timedFetch(service.slug, () =>
    runConnector(service.kind, { serviceSlug: service.slug, statusUrl: service.statusUrl }),
  );

  const officialStatus = result.status;
  if (latencyMs > 0) insertFetcherLatency(service.slug, 'official', latencyMs);

  upsertServiceStatus(service.slug, 'official', officialStatus.status, officialStatus.details, null);
  metrics.setServiceStatus(service.slug, 'official', officialStatus.status);

  if (previousStatus && previousStatus !== officialStatus.status) {
    changedServices.push(service.slug);
  }

  let activeIncidentCount = 0;
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
      incident.sourceUrl,
    );

    if (isNew) {
      metrics.incIncidents(incident.serviceSlug, incident.severity);
    }

    // Send alerts only when not in a maintenance window.
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

  insertStatusHistory(service.slug, officialStatus.status, activeIncidentCount);
  log.debug(`[cycle ${cycleId}] ${service.name}: ${officialStatus.status} (active incidents: ${activeIncidentCount})`);
}

async function processEscalations(cycleId: string) {
  try {
    const unresolved = getActiveUnresolvedIncidents(4);
    for (const incident of unresolved) {
      const recipients = evaluateRulesForEscalation(incident);
      for (const { email, level, escalationIntervals } of recipients) {
        await sendEscalationAlert(incident.service_slug, incident.incident_id, incident.title, level, [email], escalationIntervals);
      }
    }
  } catch (err) {
    log.error(`[cycle ${cycleId}] Escalation processing failed:`, err);
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
  // Short per-cycle id so every log line from this cycle — across all
  // services polled concurrently — can be grepped out of interleaved output
  // as one unit, instead of being indistinguishable from the next cycle's.
  const cycleId = randomUUID().slice(0, 8);
  if (process.env.DEBUG === 'true') {
    log.info(`[cycle ${cycleId}] Starting poll cycle at ${new Date().toISOString()}`);
  }

  let polled = 0;
  let errors = 0;

  try {
    const results = await Promise.allSettled(
      getServices().map((service) => pollService(service, cycleId)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        polled++;
      } else {
        errors++;
        log.error(`[cycle ${cycleId}] Service poll failed:`, result.reason);
      }
    }

    // Escalation alerts for long-running unresolved incidents.
    await processEscalations(cycleId);

    // Broadcast SSE event so connected clients refresh immediately.
    broadcastSSE({ type: 'poll_complete', ts: Date.now(), services_changed: [...changedServices] });

    // Best-effort web push when services changed status this cycle.
    if (changedServices.length > 0) {
      try {
        const { sendPushToAll, isPushConfigured } = await import('./push');
        if (isPushConfigured()) {
          await sendPushToAll({
            title: 'Outage Map',
            body: `${changedServices.length} service${changedServices.length !== 1 ? 's' : ''} changed status`,
            url: '/',
          });
        }
      } catch (err) {
        log.error(`[cycle ${cycleId}] Push dispatch failed:`, err);
      }
    }

    cleanupOldHistory(35);
    const prunedIncidents = cleanupOldIncidents(90);
    if (Date.now() - lastVacuumAt > VACUUM_INTERVAL_MS) {
      try {
        vacuumDb();
        lastVacuumAt = Date.now();
      } catch (err) {
        log.error(`[cycle ${cycleId}] VACUUM failed:`, err);
      }
    }
    if (process.env.DEBUG === 'true' || prunedIncidents > 0) {
      log.info(`[cycle ${cycleId}] Poll cycle complete: ${polled} succeeded, ${errors} failed, ${prunedIncidents} incidents pruned`);
    }
  } finally {
    isPolling = false;
    const durationSec = (Date.now() - cycleStart) / 1000;
    metrics.recordPollCycle(polled > 0 ? 'success' : 'failure', durationSec);
  }

  return { success: true, polled, errors };
}
