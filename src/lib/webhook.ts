import { httpFetch } from './fetchers/httpFetch';
import { hasRecentAlert, logAlert } from './db';
import { getServiceBySlug } from './services';
import { IncidentResult } from './types';
import { metrics } from './metrics';

// Block SSRF attempts: reject URLs that resolve to RFC-1918 / loopback ranges.
const PRIVATE_IP_RE = /^(https?:\/\/)(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

export function isValidWebhookUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (PRIVATE_IP_RE.test(url)) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

interface WebhookPayload {
  text: string;
  attachments: Array<{
    color: string;
    title: string;
    fields: Array<{ title: string; value: string; short: boolean }>;
  }>;
  incident: {
    service: string;
    title: string;
    severity: string;
    status: string;
    startedAt: string | null;
    sourceUrl: string | null;
  };
}

function buildPayload(incident: IncidentResult, serviceName: string): WebhookPayload {
  const color = incident.severity === 'critical' ? '#dc2626' : '#f59e0b';
  return {
    text: `[${incident.severity.toUpperCase()}] ${serviceName}: ${incident.title}`,
    attachments: [
      {
        color,
        title: `${serviceName} — ${incident.title}`,
        fields: [
          { title: 'Severity', value: incident.severity, short: true },
          { title: 'Status', value: incident.status, short: true },
          { title: 'Started', value: incident.startedAt || 'Unknown', short: true },
          ...(incident.sourceUrl ? [{ title: 'Source', value: incident.sourceUrl, short: false }] : []),
        ],
      },
    ],
    incident: {
      service: incident.serviceSlug,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      startedAt: incident.startedAt,
      sourceUrl: incident.sourceUrl,
    },
  };
}

export async function sendWebhookAlert(url: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const res = await httpFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 10000,
      maxRetries: 1,
    });
    return res.ok || res.status < 500;
  } catch (err) {
    console.error(`[webhook] POST to ${url} failed:`, err);
    return false;
  }
}

export async function sendWebhookAlerts(
  incident: IncidentResult,
  webhookUrls: string[],
): Promise<void> {
  if (webhookUrls.length === 0) return;
  if (hasRecentAlert(incident.serviceSlug, incident.incidentId, 'webhook_incident')) return;

  const service = getServiceBySlug(incident.serviceSlug);
  const serviceName = service?.name || incident.serviceSlug;
  const payload = buildPayload(incident, serviceName);

  const results = await Promise.allSettled(
    webhookUrls.map((url) => sendWebhookAlert(url, payload)),
  );

  const anyOk = results.some((r) => r.status === 'fulfilled' && r.value);
  if (anyOk) {
    logAlert(incident.serviceSlug, incident.incidentId, 'webhook_incident');
    metrics.recordAlertSent('webhook', incident.severity);
  }
}
