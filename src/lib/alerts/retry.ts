import {
  listUnresolvedFailedAlerts,
  markFailedAlertResolved,
  markFailedAlertRetryFailed,
  getFailedAlert,
  type FailedAlertRow,
} from '../db';
import { sendIncidentAlert, sendEscalationAlert, sendStatusChangeAlert } from '../email';
import { sendWebhookAlert } from '../webhook';
import { createLogger } from '../logger';
import type { IncidentResult, ServiceStatus } from '../types';

const log = createLogger('alerts/retry');

// Backoff before each auto-retry attempt, indexed by (attempts - 1). Once a
// row has exhausted this list, it's a true dead letter: it stops being
// auto-retried but stays visible (and manually retryable) via the API.
const BACKOFF_MINUTES = [5, 15, 45, 120];

function dueForRetry(row: FailedAlertRow, now: number): boolean {
  if (row.attempts > BACKOFF_MINUTES.length) return false;
  const waitMinutes = BACKOFF_MINUTES[row.attempts - 1];
  const lastAttemptMs = new Date(row.last_attempt_at).getTime();
  return now - lastAttemptMs >= waitMinutes * 60 * 1000;
}

async function retryOne(row: FailedAlertRow): Promise<boolean> {
  const payload = JSON.parse(row.payload);
  switch (row.kind) {
    case 'email_incident':
      return sendIncidentAlert(payload.incident as IncidentResult, payload.recipients as string[]);
    case 'email_escalation':
      return sendEscalationAlert(
        payload.serviceSlug, payload.incidentId, payload.incidentTitle, payload.level,
        payload.recipients, payload.escalationIntervals,
      );
    case 'email_status_change':
      return sendStatusChangeAlert(payload.serviceSlug, payload.oldStatus as ServiceStatus, payload.newStatus as ServiceStatus);
    case 'webhook_incident':
      return sendWebhookAlert(payload.url, payload.payload, payload.channelType, payload.secret);
    default:
      log.error(`Unknown failed_alert kind, cannot retry: ${row.kind}`);
      return false;
  }
}

/**
 * Called once per poll cycle. Retries due failed alerts with backoff — each
 * send function re-checks its own send-worthiness (hasRecentAlert, the
 * escalation interval state), so a retry that's no longer warranted (e.g.
 * the incident resolved, or a newer escalation already fired) just no-ops
 * rather than sending something stale.
 */
export async function processFailedAlertRetries(): Promise<void> {
  const rows = listUnresolvedFailedAlerts(100);
  const now = Date.now();
  for (const row of rows) {
    if (!dueForRetry(row, now)) continue;
    try {
      const ok = await retryOne(row);
      if (ok) {
        markFailedAlertResolved(row.id);
      } else {
        markFailedAlertRetryFailed(row.id, 'retry did not send (still failing, or no longer applicable)');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markFailedAlertRetryFailed(row.id, message);
      log.error(`Retry failed for failed_alerts#${row.id}:`, err);
    }
  }
}

/** Manual retry (from the API), regardless of backoff — the operator asked for it now. */
export async function retryFailedAlertById(id: number): Promise<{ ok: boolean; error?: string }> {
  const row = getFailedAlert(id);
  if (!row || row.resolved_at) return { ok: false, error: 'not_found' };
  try {
    const ok = await retryOne(row);
    if (ok) {
      markFailedAlertResolved(row.id);
      return { ok: true };
    }
    markFailedAlertRetryFailed(row.id, 'retry did not send (still failing, or no longer applicable)');
    return { ok: false, error: 'still_failing' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    markFailedAlertRetryFailed(row.id, message);
    return { ok: false, error: message };
  }
}
