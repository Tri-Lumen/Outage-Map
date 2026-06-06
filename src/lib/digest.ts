import { getServices } from './services';
import {
  getServiceStatuses,
  getRecentIncidents,
  getJsonSetting,
  setJsonSetting,
} from './db';
import { deriveOverallStatus } from './statusUtils';
import { sendMail } from './email';
import { sendWebhookAlert } from './webhook';
import { createLogger } from './logger';
import type { ServiceStatus } from './types';

const log = createLogger('digest');

export const DIGEST_SETTINGS_KEY = 'digest';

export interface DigestConfig {
  frequency: 'off' | 'daily' | 'weekly';
  hour: number; // 0-23, UTC
  recipients: string[];
  webhookUrl: string;
  channelType: string;
  lastSentAt: string | null;
}

const DEFAULT: DigestConfig = {
  frequency: 'off',
  hour: 9,
  recipients: [],
  webhookUrl: '',
  channelType: 'generic',
  lastSentAt: null,
};

export function getDigestConfig(): DigestConfig {
  return { ...DEFAULT, ...getJsonSetting<Partial<DigestConfig>>(DIGEST_SETTINGS_KEY, {}) };
}

export function setDigestConfig(partial: Partial<DigestConfig>): DigestConfig {
  const next = { ...getDigestConfig(), ...partial };
  setJsonSetting(DIGEST_SETTINGS_KEY, next);
  return next;
}

interface DigestData {
  total: number;
  operational: number;
  degraded: number;
  down: number;
  problems: { name: string; status: ServiceStatus }[];
  incidentCount: number;
  recent: { service: string; title: string; severity: string; status: string }[];
}

function gather(days: number): DigestData {
  const statuses = getServiceStatuses();
  const services = getServices().map((svc) => {
    const official = statuses.find((s) => s.service_slug === svc.slug && s.source === 'official');
    const overall = deriveOverallStatus((official?.status as ServiceStatus) || 'unknown');
    return { name: svc.name, overall };
  });
  const down = services.filter((s) => s.overall === 'down' || s.overall === 'major_outage').length;
  const degraded = services.filter((s) => s.overall === 'degraded').length;
  const operational = services.filter((s) => s.overall === 'operational').length;
  const problems = services.filter((s) => s.overall !== 'operational').map((s) => ({ name: s.name, status: s.overall }));
  const recentRows = getRecentIncidents(days) as Array<{ service_slug: string; title: string; severity: string; status: string }>;
  const recent = recentRows.slice(0, 20).map((r) => ({ service: r.service_slug, title: r.title, severity: r.severity, status: r.status }));
  return { total: services.length, operational, degraded, down, problems, incidentCount: recentRows.length, recent };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function renderHtml(d: DigestData, period: string): string {
  const problemRows = d.problems.length
    ? d.problems.map((p) => `<li>${esc(p.name)} — <b>${esc(p.status)}</b></li>`).join('')
    : '<li>All services operational ✓</li>';
  const incidentRows = d.recent.length
    ? d.recent.map((i) => `<tr><td style="padding:4px 8px">${esc(i.service)}</td><td style="padding:4px 8px">${esc(i.title)}</td><td style="padding:4px 8px">${esc(i.severity)}</td><td style="padding:4px 8px">${esc(i.status)}</td></tr>`).join('')
    : '<tr><td colspan="4" style="padding:8px;color:#64748b">No incidents in the period.</td></tr>';
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#1e293b">
    <h2 style="margin:0 0 4px">${period} status digest</h2>
    <p style="color:#64748b;margin:0 0 16px">${d.operational}/${d.total} operational · ${d.degraded} degraded · ${d.down} down</p>
    <h3 style="margin:16px 0 4px">Services needing attention</h3>
    <ul>${problemRows}</ul>
    <h3 style="margin:16px 0 4px">Incidents in the period (${d.incidentCount})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:#64748b"><th style="padding:4px 8px">Service</th><th style="padding:4px 8px">Title</th><th style="padding:4px 8px">Severity</th><th style="padding:4px 8px">Status</th></tr></thead><tbody>${incidentRows}</tbody></table>
  </div>`;
}

function buildWebhookPayload(subject: string, d: DigestData) {
  const lines = [`*${subject}*`, `${d.operational}/${d.total} operational · ${d.degraded} degraded · ${d.down} down`];
  if (d.problems.length) lines.push('Issues: ' + d.problems.map((p) => `${p.name} (${p.status})`).join(', '));
  lines.push(`${d.incidentCount} incidents in the period`);
  const text = lines.join('\n');
  return { text, content: text };
}

export async function sendDigestNow(): Promise<{ ok: boolean; channels: string[] }> {
  const cfg = getDigestConfig();
  const days = cfg.frequency === 'weekly' ? 7 : 1;
  const data = gather(days);
  const period = cfg.frequency === 'weekly' ? 'Weekly' : 'Daily';
  const subject = `${period} status digest — ${data.down} down, ${data.degraded} degraded`;
  const channels: string[] = [];
  let anyOk = false;

  if (cfg.recipients.length > 0 || process.env.ALERT_EMAILS) {
    const res = await sendMail(subject, renderHtml(data, period), cfg.recipients);
    if (res.ok) {
      anyOk = true;
      channels.push('email');
    }
  }
  if (cfg.webhookUrl) {
    const ok = await sendWebhookAlert(cfg.webhookUrl, buildWebhookPayload(subject, data), cfg.channelType);
    if (ok) {
      anyOk = true;
      channels.push('webhook');
    }
  }
  return { ok: anyOk, channels };
}

/** Called hourly; sends the digest when the configured hour arrives and it
 * hasn't already gone out this period. */
export async function maybeSendDigest(now: Date = new Date()): Promise<void> {
  const cfg = getDigestConfig();
  if (cfg.frequency === 'off') return;
  if (now.getUTCHours() !== cfg.hour) return;
  if (cfg.lastSentAt) {
    const elapsedH = (now.getTime() - new Date(cfg.lastSentAt).getTime()) / 3600000;
    if (cfg.frequency === 'daily' && elapsedH < 23) return;
    if (cfg.frequency === 'weekly' && elapsedH < 24 * 6.5) return;
  }
  try {
    const res = await sendDigestNow();
    if (res.ok) {
      setDigestConfig({ lastSentAt: now.toISOString() });
      log.info(`Digest sent via ${res.channels.join(', ')}`);
    } else {
      log.warn('Digest due but no channel delivered (check SMTP/webhook config)');
    }
  } catch (err) {
    log.error('Digest send failed:', err);
  }
}
