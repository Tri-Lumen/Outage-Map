import { createHmac } from 'crypto';
import { lookup } from 'dns/promises';
import { httpFetch } from './fetchers/httpFetch';
import { hasRecentAlert, logAlert, recordFailedAlert } from './db';
import { getServiceBySlug } from './services';
import { IncidentResult } from './types';
import { metrics } from './metrics';
import { buildChannelPayload } from './alerts/channelPayloads';
import { createLogger } from './logger';

const log = createLogger('webhook');

// Block SSRF attempts: reject URLs that literally name loopback, RFC-1918,
// or link-local/cloud-metadata (169.254.x.x, incl. AWS/GCP/Azure IMDS) hosts.
const PRIVATE_IP_RE =
  /^(https?:\/\/)(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?fc00:|\[?fe80:)/i;

const PRIVATE_IPV4_RE =
  /^(127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

function isPrivateIPv4(ip: string): boolean {
  return PRIVATE_IPV4_RE.test(ip);
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique local
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

// DNS-rebinding defense: the regex above only catches a URL that literally
// names a private host. A hostname that merely *resolves* to a private/
// loopback/link-local address slips past it, so resolve and check every
// returned address too. This is still a point-in-time check — the fetch
// itself re-resolves and could in principle get a different answer for a
// very-low-TTL record — but it closes the common case (a hostname that
// simply points at an internal address) rather than trusting the string.
async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  const clean = hostname.replace(/^\[|\]$/g, '');
  try {
    const addresses = await lookup(clean, { all: true });
    return addresses.some((a) => (a.family === 4 ? isPrivateIPv4(a.address) : isPrivateIPv6(a.address)));
  } catch {
    // Unresolvable — can't deliver to it anyway, so treat as invalid.
    return true;
  }
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname.replace(/[^/]+/g, '***')}`;
  } catch {
    return '[invalid url]';
  }
}

export async function isValidWebhookUrl(url: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false;
  if (PRIVATE_IP_RE.test(url)) return false;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  if (await resolvesToPrivateAddress(hostname)) return false;
  return true;
}

export async function sendWebhookAlert(
  url: string,
  payload: object,
  channelType?: string,
  ruleSecret?: string | null,
): Promise<boolean> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Opsgenie's Alert API authenticates with a GenieKey header rather than a
  // secret embedded in the URL.
  if (channelType === 'opsgenie' && process.env.OPSGENIE_API_KEY) {
    headers['Authorization'] = `GenieKey ${process.env.OPSGENIE_API_KEY}`;
  }

  // Optional HMAC signing so receivers can verify authenticity. The signature
  // covers `${timestamp}.${body}` to also bind the timestamp (replay defense).
  // A rule's own secret (reveal/rotate-able per rule) takes precedence over
  // the single shared WEBHOOK_SIGNING_SECRET env var.
  const secret = ruleSecret || process.env.WEBHOOK_SIGNING_SECRET;
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
    if (!res.ok) {
      // Don't log the full URL — Slack/Discord/Teams/PagerDuty webhook URLs
      // embed a bearer-token-equivalent secret in the path.
      log.error(`Webhook delivery to ${redactUrl(url)} failed with HTTP ${res.status}`);
    }
    return res.ok;
  } catch (err) {
    log.error(`Webhook delivery to ${redactUrl(url)} failed:`, err);
    return false;
  }
}

export async function sendWebhookAlerts(
  incident: IncidentResult,
  webhooks: { url: string; channelType: string; secret?: string | null }[],
): Promise<void> {
  if (webhooks.length === 0) return;
  if (hasRecentAlert(incident.serviceSlug, incident.incidentId, 'webhook_incident')) return;

  const service = getServiceBySlug(incident.serviceSlug);
  const serviceName = service?.name || incident.serviceSlug;

  const attempts = webhooks.map(({ url, channelType, secret }) => ({
    url,
    channelType,
    secret: secret ?? null,
    payload: buildChannelPayload(channelType, incident, serviceName),
  }));

  const results = await Promise.allSettled(
    attempts.map((a) => sendWebhookAlert(a.url, a.payload, a.channelType, a.secret)),
  );

  let anyOk = false;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      anyOk = true;
      return;
    }
    const attempt = attempts[i];
    const error = r.status === 'rejected'
      ? (r.reason instanceof Error ? r.reason.message : String(r.reason))
      : 'webhook delivery failed';
    recordFailedAlert({
      kind: 'webhook_incident',
      serviceSlug: incident.serviceSlug,
      incidentId: incident.incidentId,
      payload: { url: attempt.url, payload: attempt.payload, channelType: attempt.channelType, secret: attempt.secret },
      error,
    });
  });

  if (anyOk) {
    logAlert(incident.serviceSlug, incident.incidentId, 'webhook_incident');
    metrics.recordAlertSent('webhook', incident.severity);
  }
}
