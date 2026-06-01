import { createHmac } from 'crypto';
import { httpFetch } from './fetchers/httpFetch';
import { hasRecentAlert, logAlert } from './db';
import { getServiceBySlug } from './services';
import { IncidentResult } from './types';
import { metrics } from './metrics';
import { buildChannelPayload } from './alerts/channelPayloads';
import { createLogger } from './logger';

const log = createLogger('webhook');

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

export async function sendWebhookAlert(url: string, payload: object, channelType?: string): Promise<boolean> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Opsgenie's Alert API authenticates with a GenieKey header rather than a
  // secret embedded in the URL.
  if (channelType === 'opsgenie' && process.env.OPSGENIE_API_KEY) {
    headers['Authorization'] = `GenieKey ${process.env.OPSGENIE_API_KEY}`;
  }

  // Optional HMAC signing so receivers can verify authenticity. The signature
  // covers `${timestamp}.${body}` to also bind the timestamp (replay defense).
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (secret) {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    headers['X-Outage-Timestamp'] = ts;
    headers['X-Outage-Signature'] = `sha256=${sig}`;
  }

  try {
    const res = await httpFetch(url, {
      method: 'POST',
      headers,
      body,
      timeoutMs: 10000,
      maxRetries: 1,
    });
    return res.ok || res.status < 500;
  } catch (err) {
    log.error(`POST to ${url} failed:`, err);
    return false;
  }
}

export async function sendWebhookAlerts(
  incident: IncidentResult,
  webhooks: { url: string; channelType: string }[],
): Promise<void> {
  if (webhooks.length === 0) return;
  if (hasRecentAlert(incident.serviceSlug, incident.incidentId, 'webhook_incident')) return;

  const service = getServiceBySlug(incident.serviceSlug);
  const serviceName = service?.name || incident.serviceSlug;

  const results = await Promise.allSettled(
    webhooks.map(({ url, channelType }) => {
      const payload = buildChannelPayload(channelType, incident, serviceName);
      return sendWebhookAlert(url, payload, channelType);
    }),
  );

  const anyOk = results.some((r) => r.status === 'fulfilled' && r.value);
  if (anyOk) {
    logAlert(incident.serviceSlug, incident.incidentId, 'webhook_incident');
    metrics.recordAlertSent('webhook', incident.severity);
  }
}
